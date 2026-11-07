/** Time windows the dashboard supports. */
export const WINDOWS = { "24h": 24 * 3600, "30d": 30 * 24 * 3600 } as const;
export type WindowKey = keyof typeof WINDOWS;

/** Validated dashboard query. */
export interface DashboardQuery {
  window: WindowKey;
  capability?: string;
}

/** Result of validating query parameters. */
export type ValidationResult =
  | { ok: true; value: DashboardQuery }
  | { ok: false; error: string };

/**
 * Validates dashboard query parameters.
 * @param params - URL search params.
 * @returns The parsed query, or an error message for a 400 response.
 */
export function validateDashboardQuery(params: URLSearchParams): ValidationResult {
  const window = params.get("window") ?? "24h";
  if (!(window in WINDOWS)) {
    return { ok: false, error: "window must be 24h or 30d" };
  }
  const capability = params.get("capability")?.trim();
  if (capability && (capability.length > 100 || /[\u0000-\u001f]/.test(capability))) {
    return { ok: false, error: "capability is invalid" };
  }
  return { ok: true, value: { window: window as WindowKey, capability: capability || undefined } };
}

/**
 * Formats an epoch-seconds time as a UTC YYYY-MM-DD string for the export API.
 * @param epochSeconds - Time in seconds.
 * @returns Date string.
 */
export function toDateString(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}
