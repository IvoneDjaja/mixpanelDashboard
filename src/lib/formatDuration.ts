/**
 * Formats seconds as a compact duration such as "1m 05s".
 * @param s - Duration in seconds.
 * @returns The formatted duration.
 */
export function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`;
}
