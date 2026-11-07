"use client";

import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/analytics/dashboard";
import { StateMessage } from "./StateMessage";

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
  const [window, setWindow] = useState<"24h" | "30d">("24h");
  const [capability, setCapability] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ window });
    if (capability) params.set("capability", capability);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
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
  }, [window, capability]);

  const data = status.kind === "ok" ? status.data : null;

  return (
    <main className="dashboard">
      <header>
        <h1>Pruservices Customer Journey</h1>
        <div className="controls">
          <div role="group" aria-label="Time window">
            {(["24h", "30d"] as const).map((w) => (
              <button key={w} aria-pressed={window === w} onClick={() => setWindow(w)}>
                {w === "24h" ? "Last 24 hours" : "Last 30 days"}
              </button>
            ))}
          </div>
          <label>
            Function{" "}
            <select value={capability} onChange={(e) => setCapability(e.target.value)}>
              <option value="">All</option>
              {(data?.capabilities ?? []).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
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
              <table><thead><tr><th>Page</th><th>Views</th><th>Visitors</th></tr></thead>
                <tbody>{data.mostVisited.map((p) => <tr key={p.page}><td>{p.page}</td><td>{p.views}</td><td>{p.uniqueVisitors}</td></tr>)}</tbody></table>
            </section>
            <section>
              <h2>Least visited pages</h2>
              <table><thead><tr><th>Page</th><th>Views</th><th>Visitors</th></tr></thead>
                <tbody>{data.leastVisited.map((p) => <tr key={p.page}><td>{p.page}</td><td>{p.views}</td><td>{p.uniqueVisitors}</td></tr>)}</tbody></table>
            </section>
            <section>
              <h2>Time on page</h2>
              {data.timeOnPage.length === 0 ? <StateMessage kind="empty" message="n/a (needs sessions with 2+ page views)" /> : (
                <table><thead><tr><th>Page</th><th>Average</th><th>Median</th><th>Samples</th></tr></thead>
                  <tbody>{data.timeOnPage.map((p) => <tr key={p.page}><td>{p.page}</td><td>{fmtSeconds(p.averageSeconds)}</td><td>{fmtSeconds(p.medianSeconds)}</td><td>{p.samples}</td></tr>)}</tbody></table>
              )}
            </section>
            <section>
              <h2>Login mode</h2>
              {data.loginModes.length === 0 ? <StateMessage kind="empty" message="No login mode recorded." /> : (
                <table><thead><tr><th>Mode</th><th>Sessions</th><th>Share</th></tr></thead>
                  <tbody>{data.loginModes.map((m) => <tr key={m.mode}><td>{m.mode}</td><td>{m.sessions}</td><td>{m.percent.toFixed(0)}%</td></tr>)}</tbody></table>
              )}
            </section>
            <section className="wide">
              <h2>Top journey paths</h2>
              <table><thead><tr><th>Path</th><th>Sessions</th><th>Share</th></tr></thead>
                <tbody>{data.paths.map((p) => <tr key={p.path.join(">")}><td>{p.path.join(" → ")}</td><td>{p.sessions}</td><td>{p.percent.toFixed(0)}%</td></tr>)}</tbody></table>
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
