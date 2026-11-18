import { DEFAULT_PAGE_SIZE, PAGE_SIZES, isPageSize, type PageSize } from "./pagination";

/** Time windows the dashboard supports. */
export const WINDOWS = { "1h": 3600, "24h": 24 * 3600, "30d": 30 * 24 * 3600 } as const;
export type WindowKey = keyof typeof WINDOWS;

/** Event `Environment` values the dashboard can be scoped to. */
export const ENVIRONMENTS = ["DEV", "SIT", "UAT", "PROD"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];
export const DEFAULT_ENVIRONMENT: Environment = "UAT";

/** Event `LBU` values the dashboard can be scoped to. */
export const LBUS = ["PACS", "PAMB", "PBTB"] as const;
export type Lbu = (typeof LBUS)[number];
export const DEFAULT_LBU: Lbu = "PACS";

/** Validated dashboard query. */
export interface DashboardQuery {
  window: WindowKey;
  capability?: string;
  /** Environment the events are scoped to. */
  environment: Environment;
  /** Line of business the events are scoped to. */
  lbu: Lbu;
  /** 1-based page of the events table. */
  page: number;
  /** Rows per page of the events table. */
  pageSize: PageSize;
}

/** Result of validating query parameters. */
export type ValidationResult =
  | { ok: true; value: DashboardQuery }
  | { ok: false; error: string };

/**
 * Validates dashboard query parameters. Environment and LBU are read from the
 * `x-environment` and `x-lbu` request headers, not the URL, and default to UAT
 * and PACS when absent.
 * @param params - URL search params.
 * @param headers - Request headers.
 * @returns The parsed query, or an error message for a 400 response.
 */
export function validateDashboardQuery(
  params: URLSearchParams,
  headers: Headers = new Headers(),
): ValidationResult {
  const window = params.get("window") ?? "24h";
  if (!(window in WINDOWS)) {
    return { ok: false, error: "window must be 1h, 24h or 30d" };
  }
  const capability = params.get("capability")?.trim();
  if (capability && (capability.length > 100 || /[\u0000-\u001f]/.test(capability))) {
    return { ok: false, error: "capability is invalid" };
  }
  const environment = headers.get("x-environment") ?? DEFAULT_ENVIRONMENT;
  if (!(ENVIRONMENTS as readonly string[]).includes(environment)) {
    return { ok: false, error: `environment must be one of ${ENVIRONMENTS.join(", ")}` };
  }
  const lbu = headers.get("x-lbu") ?? DEFAULT_LBU;
  if (!(LBUS as readonly string[]).includes(lbu)) {
    return { ok: false, error: `lbu must be one of ${LBUS.join(", ")}` };
  }
  const pageParam = params.get("page");
  const page = pageParam === null ? 1 : Number(pageParam);
  if (!Number.isInteger(page) || page < 1) {
    return { ok: false, error: "page must be a positive integer" };
  }
  const sizeParam = params.get("pageSize");
  const pageSize = sizeParam === null ? DEFAULT_PAGE_SIZE : Number(sizeParam);
  if (!isPageSize(pageSize)) {
    return { ok: false, error: `pageSize must be one of ${PAGE_SIZES.join(", ")}` };
  }
  return {
    ok: true,
    value: {
      window: window as WindowKey,
      capability: capability || undefined,
      environment: environment as Environment,
      lbu: lbu as Lbu,
      page,
      pageSize,
    },
  };
}

/** Result of validating a user id parameter. */
export type UserIdResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validates the required `userId` query parameter.
 * @param params - URL search params.
 * @returns The user id, or an error message for a 400 response.
 */
export function validateUserId(params: URLSearchParams): UserIdResult {
  const userId = params.get("userId")?.trim();
  if (!userId) return { ok: false, error: "userId is required" };
  if (userId.length > 100 || /[\u0000-\u001f]/.test(userId)) {
    return { ok: false, error: "userId is invalid" };
  }
  return { ok: true, value: userId };
}

/** Validated login form input. */
export interface LoginInput {
  user: string;
  secret: string;
  projectId: string;
  region: "us" | "eu" | "in";
}

/** Result of validating a login body. */
export type LoginResult = { ok: true; value: LoginInput } | { ok: false; error: string };

/** Longest accepted credential field; real values are far shorter. */
const LOGIN_FIELD_MAX = 200;

/**
 * Validates the login request body.
 * @param body - Parsed JSON body (any shape).
 * @returns The trimmed credentials, or an error message for a 400 response. The
 *   message never echoes a submitted value.
 */
export function validateLogin(body: unknown): LoginResult {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const field = (name: string) => (typeof raw[name] === "string" ? (raw[name] as string).trim() : "");
  const user = field("user");
  const secret = field("secret");
  const projectId = field("projectId");
  const region = field("region");

  if (!user) return { ok: false, error: "Service account user is required" };
  if (!secret) return { ok: false, error: "Service account secret is required" };
  if (!projectId) return { ok: false, error: "Project ID is required" };
  if (user.length > LOGIN_FIELD_MAX || secret.length > LOGIN_FIELD_MAX || /[\u0000-\u001f]/.test(user + secret)) {
    return { ok: false, error: "Credentials are invalid" };
  }
  if (!/^\d{1,20}$/.test(projectId)) return { ok: false, error: "Project ID must be numeric" };
  if (region !== "us" && region !== "eu" && region !== "in") {
    return { ok: false, error: "Region must be us, eu or in" };
  }
  return { ok: true, value: { user, secret, projectId, region } };
}

/**
 * Formats an epoch-seconds time as a UTC YYYY-MM-DD string for the export API.
 * @param epochSeconds - Time in seconds.
 * @returns Date string.
 */
export function toDateString(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}
