import "server-only";
import { cachedDay, dayCacheKey } from "./dayCache";
import type { MixpanelConfig, MixpanelEvent, MixpanelRegion } from "./types";

const EXPORT_HOSTS: Record<MixpanelRegion, string> = {
  us: "https://data.mixpanel.com",
  eu: "https://data-eu.mixpanel.com",
  in: "https://data-in.mixpanel.com",
};

// The export endpoint is day-granular and streams NDJSON. One spanning request
// for a multi-day range serialises the whole download into a single budget,
// which a full day of events is already close to exhausting; two days reliably
// overran it and surfaced as a 504. Each day is now fetched separately, so a
// day gets a whole budget to itself and days download in parallel.
const DAY_TIMEOUT_MS = 60_000;

// Mixpanel allows 3 export queries per second and 100 concurrent; staying at 3
// respects the per-second limit without needing to pace individual requests.
const MAX_CONCURRENT_DAY_QUERIES = 3;

/** The only event the dashboard analyses (see toPageViews). */
const PAGE_VIEW_EVENT = "page_viewed";

/** Longest upstream snippet retained on an error for server-side logging. */
const DETAIL_MAX_LENGTH = 200;

/**
 * Plain-text bodies Mixpanel returns with HTTP 200 when the project or plan
 * refuses the export. Matched case-insensitively.
 */
const NO_ACCESS_MARKERS = ["terminated early", "your plan does not support"];

/** Failure categories so callers can map errors to HTTP responses. */
export type MixpanelErrorKind =
  | "config"
  | "auth"
  | "rate_limit"
  | "no_access"
  | "timeout"
  | "upstream";

/** Error raised by the Mixpanel client. Messages never contain credentials. */
export class MixpanelError extends Error {
  /**
   * @param kind - Failure category.
   * @param message - Safe summary, free of credentials.
   * @param detail - Optional upstream snippet for server-side logs only; never
   *   returned to the browser and never contains event data.
   */
  constructor(
    public readonly kind: MixpanelErrorKind,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "MixpanelError";
  }
}

/**
 * Reads Mixpanel settings from environment variables.
 * Uses a service account (MIXPANEL_SERVICE_ACCOUNT_USER/SECRET + MIXPANEL_PROJECT_ID)
 * when configured, otherwise falls back to the legacy project API Secret (MIXPANEL_API_SECRET).
 * Property filters (Environment, LBU) are not read here; callers pass them via
 * `config.filters` (see the dashboard route).
 * @param env - Environment to read from (defaults to process.env).
 * @returns Validated configuration.
 * @throws MixpanelError of kind "config" when a variable is missing or invalid.
 */
export function getMixpanelConfig(
  env: Record<string, string | undefined> = process.env,
): MixpanelConfig {
  const user = env.MIXPANEL_SERVICE_ACCOUNT_USER;
  const secret = env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
  const apiSecret = env.MIXPANEL_API_SECRET;
  const projectId = env.MIXPANEL_PROJECT_ID;
  const region = (env.MIXPANEL_REGION ?? "us") as MixpanelRegion;

  if (!(region in EXPORT_HOSTS)) {
    throw new MixpanelError("config", "MIXPANEL_REGION must be us, eu or in");
  }

  if (!user && !secret && apiSecret) {
    return { secret: apiSecret, projectId: projectId || undefined, region };
  }

  const missing = [
    !user && "MIXPANEL_SERVICE_ACCOUNT_USER",
    !secret && "MIXPANEL_SERVICE_ACCOUNT_SECRET",
    !projectId && "MIXPANEL_PROJECT_ID",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new MixpanelError("config", `Missing env: ${missing.join(", ")} (or set MIXPANEL_API_SECRET)`);
  }
  return { user: user!, secret: secret!, projectId: projectId!, region };
}

/**
 * Escapes a value for use inside a double-quoted Mixpanel expression string.
 * @param value - Raw value.
 * @returns The value with backslashes and double quotes escaped.
 */
function escapeExpressionString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Builds the Mixpanel `where` expression restricting an export to the given
 * property values. Each comparison is parenthesised and joined with `and`, both
 * of which the segmentation-expression grammar allows.
 * @param filters - Property name to required value.
 * @returns An expression such as `(properties["Environment"] == "UAT") and
 *   (properties["Lbu"] == "SG")`, or undefined when there is nothing to filter.
 */
export function propertyWhereClause(filters: Record<string, string>): string | undefined {
  const clauses = Object.entries(filters).map(
    ([property, value]) =>
      `(properties["${escapeExpressionString(property)}"] == "${escapeExpressionString(value)}")`,
  );
  return clauses.length === 0 ? undefined : clauses.join(" and ");
}

/**
 * Compares an event property against a required filter value, ignoring case.
 *
 * Mixpanel's server-side `where` comparison matches case-insensitively: a filter
 * of `Environment == "UAT"` returns events whose property is `"uat"`. This local
 * pass has to agree, because a strict comparison here discarded every event the
 * API had already accepted and left the dashboard empty.
 * @param actual - The event's property value.
 * @param expected - The required value.
 * @returns True when both are strings differing only in case.
 */
function matchesFilterValue(actual: unknown, expected: string): boolean {
  return typeof actual === "string" && actual.toLowerCase() === expected.toLowerCase();
}

/**
 * Keeps only events matching every configured property filter. Applied to local
 * fixture files, which Mixpanel's server-side `where` filter cannot reach, and
 * harmless as a second pass over already-filtered API results.
 *
 * Values are matched case-insensitively (see matchesFilterValue); property names
 * are matched exactly, as Mixpanel treats them as case-sensitive.
 * @param events - Events to filter.
 * @param filters - Property name to required value; no filtering when empty.
 * @returns The matching events, or all events when no filters are configured.
 */
export function filterByProperties(
  events: MixpanelEvent[],
  filters: Record<string, string>,
): MixpanelEvent[] {
  const required = Object.entries(filters);
  if (required.length === 0) return events;
  return events.filter((event) =>
    required.every(([property, value]) => matchesFilterValue(event.properties?.[property], value)),
  );
}

/**
 * Parses newline-delimited JSON from the export endpoint, skipping blank lines.
 * @param body - Raw response text.
 * @returns Parsed events.
 */
export function parseExportLines(body: string): MixpanelEvent[] {
  return body
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as MixpanelEvent);
}

/**
 * Counts the days covered by an inclusive date range.
 * @param range - Inclusive dates in YYYY-MM-DD format.
 * @returns Day count, at least 1; 1 when either date cannot be parsed.
 */
export function daysInRange(range: { from: string; to: string }): number {
  const from = Date.parse(`${range.from}T00:00:00Z`);
  const to = Date.parse(`${range.to}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 1;
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

/**
 * Expands an inclusive date range into the individual days it covers.
 * @param range - Inclusive dates in YYYY-MM-DD format.
 * @returns Days in ascending order, each YYYY-MM-DD; the `from` date alone when
 *   the range cannot be parsed.
 */
export function eachDay(range: { from: string; to: string }): string[] {
  const start = Date.parse(`${range.from}T00:00:00Z`);
  if (Number.isNaN(start)) return [range.from];
  return Array.from({ length: daysInRange(range) }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Condenses an upstream body into a short, single-line snippet for logs.
 * @param body - Raw response text.
 * @returns Whitespace-collapsed text, truncated to DETAIL_MAX_LENGTH.
 */
function toDetail(body: string): string {
  const collapsed = body.trim().replace(/\s+/g, " ");
  return collapsed.length > DETAIL_MAX_LENGTH
    ? `${collapsed.slice(0, DETAIL_MAX_LENGTH)}...`
    : collapsed;
}

/**
 * Best-effort read of an error response body, for diagnostics only.
 * @param response - The failed response.
 * @returns A log-safe snippet, or undefined when the body is empty or unreadable.
 */
async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.trim() === "" ? undefined : toDetail(text);
  } catch {
    return undefined;
  }
}

/**
 * Describes a thrown transport value for server-side logs, following the `cause`
 * chain. Undici wraps a mid-stream failure as `TypeError: terminated` and puts the
 * real reason in `cause`, so the chain is what identifies the fault. Only names,
 * messages and string codes are included; credentials travel in a request header
 * and never appear in these fields.
 * @param error - The caught value.
 * @returns A log-safe description, or undefined when nothing is available.
 */
function describeError(error: unknown): string | undefined {
  const parts: string[] = [];
  let current = error as
    | { name?: string; message?: string; code?: string; cause?: unknown }
    | null
    | undefined;
  for (let depth = 0; current && depth < 3; depth += 1) {
    const code = typeof current.code === "string" ? ` (${current.code})` : "";
    const label = `${current.name ?? "Error"}: ${current.message ?? ""}`.trim();
    parts.push(`${label}${code}`);
    current = current.cause as typeof current;
  }
  const joined = parts.filter(Boolean).join(" <- ");
  return joined === "" ? undefined : toDetail(joined);
}

/**
 * Maps a fetch/body-read failure to a MixpanelError. Matches on `name` rather than
 * `instanceof Error` because a DOMException from AbortSignal.timeout is not always
 * an Error instance across runtimes, and also checks the signal itself: when the
 * abort lands mid-body, undici rethrows it wrapped as a TypeError, which the name
 * check alone misreads as an upstream fault.
 * @param error - The caught value.
 * @param fallbackMessage - Message used when the failure is not a timeout.
 * @param timeoutMs - Budget that applied, reported on a timeout for diagnosis.
 * @param signal - Timeout signal, consulted to detect a wrapped abort.
 * @param day - Day being exported, named in the detail to show which one stalled.
 * @returns A "timeout" error for aborts, otherwise an "upstream" error.
 */
function toTransportError(
  error: unknown,
  fallbackMessage: string,
  timeoutMs?: number,
  signal?: AbortSignal,
  day?: string,
): MixpanelError {
  const name = (error as { name?: string } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError" || signal?.aborted) {
    const budget = timeoutMs ? `exceeded ${Math.round(timeoutMs / 1000)}s budget` : "aborted";
    return new MixpanelError("timeout", "Mixpanel request timed out", day ? `${budget} for ${day}` : budget);
  }
  // Not our abort: the connection failed on its own, so record the whole chain.
  return new MixpanelError("upstream", fallbackMessage, describeError(error));
}

/**
 * Fetches raw events for a single day from the Mixpanel Export API.
 * @param day - The day to export, YYYY-MM-DD.
 * @param config - Mixpanel settings.
 * @param fetchImpl - Fetch implementation, injectable for tests.
 * @returns Events recorded that day.
 * @throws MixpanelError on auth, rate limit, timeout or upstream failures.
 */
async function fetchDay(
  day: string,
  config: MixpanelConfig,
  fetchImpl: typeof fetch,
): Promise<MixpanelEvent[]> {
  const url = new URL("/api/2.0/export", EXPORT_HOSTS[config.region]);
  if (config.projectId) url.searchParams.set("project_id", config.projectId);
  url.searchParams.set("from_date", day);
  url.searchParams.set("to_date", day);
  // The dashboard only uses page views; filtering server-side shrinks the download.
  url.searchParams.set("event", JSON.stringify([PAGE_VIEW_EVENT]));
  // Scoping by environment/LBU server-side shrinks it further, which matters
  // because a full day is already close to the per-request budget.
  const where = propertyWhereClause(config.filters ?? {});
  if (where) url.searchParams.set("where", where);

  // Service account: user:secret. Legacy API Secret: secret as username, empty password.
  const credentials = config.user ? `${config.user}:${config.secret}` : `${config.secret}:`;
  const authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;

  // The timeout signal also covers the body download, so both the request and
  // the body read must map aborts to a "timeout" error.
  const signal = AbortSignal.timeout(DAY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: authorization, Accept: "text/plain" },
      signal,
      cache: "no-store",
    });
  } catch (error) {
    throw toTransportError(error, "Could not reach Mixpanel", DAY_TIMEOUT_MS, signal, day);
  }

  if (!response.ok) {
    // Read the body before branching so every failure carries a diagnosable snippet.
    const detail = await readDetail(response);
    if (response.status === 401 || response.status === 403) {
      throw new MixpanelError("auth", "Mixpanel rejected the credentials", detail);
    }
    if (response.status === 429) {
      throw new MixpanelError("rate_limit", "Mixpanel rate limit reached", detail);
    }
    throw new MixpanelError("upstream", `Mixpanel returned ${response.status}`, detail);
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    throw toTransportError(error, "Mixpanel response could not be read", DAY_TIMEOUT_MS, signal, day);
  }

  const trimmed = body.trim();
  // An empty body means no events that day, not a failure.
  if (trimmed === "") return [];

  // Mixpanel answers 200 with a plain-text explanation when the project or plan
  // refuses the export ("terminated early", "Your plan does not support raw data
  // export", ...). NDJSON always starts with "{", so anything else is a message,
  // not data. Matching one fixed phrase previously let these reach the JSON
  // parser and surface as an opaque "malformed data" 502.
  if (!trimmed.startsWith("{")) {
    const detail = toDetail(trimmed);
    const lower = detail.toLowerCase();
    if (NO_ACCESS_MARKERS.some((marker) => lower.includes(marker))) {
      throw new MixpanelError(
        "no_access",
        "Mixpanel project does not allow export API access",
        detail,
      );
    }
    throw new MixpanelError("upstream", "Mixpanel returned a non-JSON response", detail);
  }

  try {
    return parseExportLines(trimmed);
  } catch {
    // The body is event data here, so it is deliberately kept out of the detail.
    throw new MixpanelError("upstream", "Mixpanel returned malformed data");
  }
}

/**
 * Fetches raw events for a date range from the Mixpanel Export API, one request
 * per day so that no single response has to stream the whole range.
 *
 * Days are served from the per-day cache (see dayCache), so only days that are
 * absent or stale reach Mixpanel. This matters because a cold range costs one
 * query per day against Mixpanel's limit of 60 export queries per hour: a
 * 30-day window would otherwise be affordable only twice an hour, and paging
 * the events table re-spent that cost on every click.
 * @param range - Inclusive dates in YYYY-MM-DD format.
 * @param config - Mixpanel settings (defaults to environment).
 * @param fetchImpl - Fetch implementation, injectable for tests.
 * @returns Events in the range, ordered by day.
 * @throws MixpanelError on configuration, auth, rate limit, timeout or upstream failures.
 */
export async function fetchEvents(
  range: { from: string; to: string },
  config: MixpanelConfig = getMixpanelConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<MixpanelEvent[]> {
  const days = eachDay(range);
  const perDay: MixpanelEvent[][] = new Array(days.length);

  // A shared cursor keeps at most MAX_CONCURRENT_DAY_QUERIES requests in flight
  // while preserving day order in `perDay`.
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (let i = cursor++; i < days.length; i = cursor++) {
      const day = days[i];
      perDay[i] = await cachedDay(dayCacheKey(day, config), day, () =>
        fetchDay(day, config, fetchImpl),
      );
    }
  };
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_DAY_QUERIES, days.length) },
    worker,
  );
  // Promise.all rejects on the first failure; every worker is awaited here, so
  // no sibling rejection goes unhandled.
  await Promise.all(workers);

  return perDay.flat();
}
