"use client";

import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/analytics/dashboard";
import type { WindowKey } from "@/lib/validation";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@/lib/pagination";
import { PaginatedTable } from "./PaginatedTable";
import { Pagination } from "./Pagination";
import { StateMessage } from "./StateMessage";

/** Button labels for each supported time window, in display order. */
const WINDOW_LABELS: Record<WindowKey, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "30d": "Last 30 days",
};

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ok"; data: DashboardData };

/** Formats seconds as a compact duration such as "1m 05s". */
function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`;
}

/**
 * Dashboard page body: window and capability controls plus all report tables.
 * Fetches data from /api/dashboard.
 * @returns The dashboard UI.
 */
export function DashboardView() {
  // Filter edits are held here and never fetch on their own; Apply promotes them.
  const [pending, setPending] = useState({ window: "24h" as WindowKey, capability: "" });
  // The only state that drives requests: initial load, Apply, and paging changes.
  const [applied, setApplied] = useState({
    window: "24h" as WindowKey,
    capability: "",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE as PageSize,
  });
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const filtersDirty = pending.window !== applied.window || pending.capability !== applied.capability;

  useEffect(() => {
    const controller = new AbortController();
    const { window, capability, page, pageSize } = applied;
    const params = new URLSearchParams({ window, page: String(page), pageSize: String(pageSize) });
    if (capability) params.set("capability", capability);
    // Keep the previous data on screen while another page loads (no flicker).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus((prev) => (prev.kind === "ok" ? prev : { kind: "loading" }));
    fetch(`/api/dashboard?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Request failed");
        setStatus({ kind: "ok", data: body as DashboardData });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setStatus({ kind: "error", message: e.message });
      });
    return () => controller.abort();
  }, [applied]);

  const data = status.kind === "ok" ? status.data : null;

  return (
    <main className="dashboard">
      <header>
        <h1>Pruservices Customer Journey</h1>
        <div className="controls">
          <div role="group" aria-label="Time window">
            {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((w) => (
              <button key={w} aria-pressed={pending.window === w} onClick={() => setPending((p) => ({ ...p, window: w }))}>
                {WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
          <label>
            Function{" "}
            <select value={pending.capability} onChange={(e) => setPending((p) => ({ ...p, capability: e.target.value }))}>
              <option value="">All</option>
              {(data?.capabilities ?? []).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            disabled={!filtersDirty}
            onClick={() => setApplied((a) => ({ ...a, window: pending.window, capability: pending.capability, page: 1 }))}
          >
            Apply
          </button>
        </div>
      </header>

      {status.kind === "loading" && <StateMessage kind="loading" />}
      {status.kind === "error" && <StateMessage kind="error" message={status.message} />}
      {data && data.totalViews === 0 && <StateMessage kind="empty" />}
      {data && data.totalViews > 0 && (
        <>
          <section className="kpis">
            <div><strong>{data.totalViews}</strong> page views</div>
            <div><strong>{data.totalSessions}</strong> sessions</div>
          </section>
          <div className="grid">
            <section>
              <h2>Most visited pages</h2>
              <PaginatedTable headers={["Page", "Views", "Visitors"]} rows={data.mostVisited} rowKey={(p) => p.page}
                renderRow={(p) => <><td>{p.page}</td><td>{p.views}</td><td>{p.uniqueVisitors}</td></>} />
            </section>
            <section>
              <h2>Least visited pages</h2>
              <PaginatedTable headers={["Page", "Views", "Visitors"]} rows={data.leastVisited} rowKey={(p) => p.page}
                renderRow={(p) => <><td>{p.page}</td><td>{p.views}</td><td>{p.uniqueVisitors}</td></>} />
            </section>
            <section>
              <h2>Time on page</h2>
              {data.timeOnPage.length === 0 ? <StateMessage kind="empty" message="n/a (needs sessions with 2+ page views)" /> : (
                <PaginatedTable headers={["Page", "Average", "Median", "Samples"]} rows={data.timeOnPage} rowKey={(p) => p.page}
                  renderRow={(p) => <><td>{p.page}</td><td>{fmtSeconds(p.averageSeconds)}</td><td>{fmtSeconds(p.medianSeconds)}</td><td>{p.samples}</td></>} />
              )}
            </section>
            <section>
              <h2>Login mode</h2>
              {data.loginModes.length === 0 ? <StateMessage kind="empty" message="No login mode recorded." /> : (
                <PaginatedTable headers={["Mode", "Sessions", "Share"]} rows={data.loginModes} rowKey={(m) => m.mode}
                  renderRow={(m) => <><td>{m.mode}</td><td>{m.sessions}</td><td>{m.percent.toFixed(0)}%</td></>} />
              )}
            </section>
            <section className="wide">
              <h2>Top journey paths</h2>
              <PaginatedTable headers={["Path", "Sessions", "Share"]} rows={data.paths} rowKey={(p) => p.path.join(">")}
                renderRow={(p) => <><td>{p.path.join(" → ")}</td><td>{p.sessions}</td><td>{p.percent.toFixed(0)}%</td></>} />
            </section>
            <section className="wide">
              <h2>Events</h2>
              {data.events.total === 0 ? <StateMessage kind="empty" message="No events in this window." /> : (
                <>
                  <table>
                    <thead><tr><th>Time</th><th>Event</th><th>Page</th><th>Function</th><th>Login mode</th><th>User</th></tr></thead>
                    <tbody>
                      {data.events.rows.map((e, i) => (
                        <tr key={`${e.time}-${e.userId ?? ""}-${i}`}>
                          <td>{new Date(e.time * 1000).toLocaleString()}</td><td>{e.event}</td><td>{e.page ?? "—"}</td>
                          <td>{e.capability ?? "—"}</td><td>{e.signInType ?? "—"}</td><td>{e.userId ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination page={data.events.page} totalPages={data.events.totalPages} pageSize={applied.pageSize}
                    onPageChange={(p) => setApplied((a) => ({ ...a, page: p }))}
                    onPageSizeChange={(n) => setApplied((a) => ({ ...a, pageSize: n, page: 1 }))} />
                </>
              )}
            </section>
            <section className="wide">
              <h2>Page performance and latency</h2>
              <StateMessage kind="empty" message="No latency data: current events don't include a load-time property." />
            </section>
          </div>
        </>
      )}
    </main>
  );
}
