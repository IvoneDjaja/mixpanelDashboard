"use client";

import { useEffect, useState } from "react";
import type { DashboardData, EventRow } from "@/lib/analytics/dashboard";
import type { UsersData } from "@/lib/analytics/users";
import { DEFAULT_ENVIRONMENT, DEFAULT_LBU, type Environment, type Lbu, type WindowKey } from "@/lib/validation";
import { DEFAULT_PAGE_SIZE, type Page, type PageSize } from "@/lib/pagination";
import { EventsTable } from "./EventsTable";
import { FilterBar, type FilterValues } from "./FilterBar";
import { LeftPane } from "./LeftPane";
import { PaginatedTable } from "./PaginatedTable";
import { StateMessage } from "./StateMessage";
import { UsersTable } from "./UsersTable";

/** Items listed in the left pane; the first is shown by default. */
const NAV_ITEMS = [
  { id: "events", label: "Events" },
  { id: "users", label: "User" },
] as const;
type NavId = (typeof NAV_ITEMS)[number]["id"];

/** API route backing each left pane item. */
const ENDPOINTS: Record<NavId, string> = { events: "/api/dashboard", users: "/api/users" };

/** API route returning the events of a single user. */
const USER_EVENTS_ENDPOINT = "/api/users/events";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; item: "events"; data: DashboardData }
  | { kind: "ok"; item: "users"; data: UsersData }
  | { kind: "ok"; item: "userEvents"; data: Page<EventRow> };

/** Formats seconds as a compact duration such as "1m 05s". */
function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`;
}

/**
 * Dashboard page body: window, environment and LBU controls plus all report tables.
 * Fetches data from /api/dashboard.
 * @returns The dashboard UI.
 */
export function DashboardView() {
  // Filter edits are held here and never fetch on their own; Apply promotes them.
  const [pending, setPending] = useState<FilterValues>({
    window: "24h" as WindowKey,
    environment: DEFAULT_ENVIRONMENT as Environment,
    lbu: DEFAULT_LBU as Lbu,
  });
  // The only state that drives requests: initial load, Apply, item and paging changes.
  const [applied, setApplied] = useState({
    ...pending,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE as PageSize,
  });
  const [activeItem, setActiveItem] = useState<NavId>(NAV_ITEMS[0].id);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const filtersDirty =
    pending.window !== applied.window ||
    pending.environment !== applied.environment ||
    pending.lbu !== applied.lbu;

  useEffect(() => {
    const controller = new AbortController();
    const { window, environment, lbu, page, pageSize } = applied;
    const params = new URLSearchParams({ window, page: String(page), pageSize: String(pageSize) });
    const item: NavId | "userEvents" = selectedUser ? "userEvents" : activeItem;
    if (selectedUser) params.set("userId", selectedUser);
    // Keep the previous data on screen while another page of the same item loads (no flicker).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus((prev) => (prev.kind === "ok" && prev.item === item ? prev : { kind: "loading" }));
    // Environment and LBU travel as headers so the URL carries only window/paging params.
    fetch(`${item === "userEvents" ? USER_EVENTS_ENDPOINT : ENDPOINTS[activeItem]}?${params}`, {
      signal: controller.signal,
      headers: { "x-environment": environment, "x-lbu": lbu },
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Request failed");
        setStatus(
          item === "events"
            ? { kind: "ok", item: "events", data: body as DashboardData }
            : item === "users"
              ? { kind: "ok", item: "users", data: body as UsersData }
              : { kind: "ok", item: "userEvents", data: body as Page<EventRow> },
        );
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setStatus({ kind: "error", message: e.message });
      });
    return () => controller.abort();
  }, [applied, activeItem, selectedUser]);

  /** Switches the left pane item, starting from page 1 with the applied filters. */
  const selectItem = (id: string) => {
    if (id === activeItem) return;
    setActiveItem(id as NavId);
    setSelectedUser(null);
    setApplied((a) => ({ ...a, page: 1 }));
  };

  /** Shows the events of one user, starting from page 1. */
  const selectUser = (userId: string) => {
    setSelectedUser(userId);
    setApplied((a) => ({ ...a, page: 1 }));
  };

  /** Returns from a user's events to the users list, starting from page 1. */
  const clearUser = () => {
    setSelectedUser(null);
    setApplied((a) => ({ ...a, page: 1 }));
  };

  const data = status.kind === "ok" && status.item === "events" ? status.data : null;
  const usersData = status.kind === "ok" && status.item === "users" ? status.data : null;
  const userEventsData = status.kind === "ok" && status.item === "userEvents" ? status.data : null;
  const filterBar = (
    <FilterBar
      values={pending}
      dirty={filtersDirty}
      onChange={(update) => setPending((p) => ({ ...p, ...update }))}
      onApply={() => setApplied((a) => ({ ...a, ...pending, page: 1 }))}
    />
  );

  return (
    <div className="shell">
      <LeftPane items={[...NAV_ITEMS]} activeId={activeItem} onSelect={selectItem} />
      {activeItem === "events" && (
    <main className="dashboard">
      <header>
        <h1>Pruservices Customer Journey</h1>
        {filterBar}
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
              <EventsTable events={data.events} pageSize={applied.pageSize}
                onPageChange={(p) => setApplied((a) => ({ ...a, page: p }))}
                onPageSizeChange={(n) => setApplied((a) => ({ ...a, pageSize: n, page: 1 }))} />
            </section>
            <section className="wide">
              <h2>Page performance and latency</h2>
              <StateMessage kind="empty" message="No latency data: current events don't include a load-time property." />
            </section>
          </div>
        </>
      )}
    </main>
      )}
      {activeItem === "users" && (
        <main className="dashboard">
          <header>
            <h1>Users</h1>
            {filterBar}
          </header>
          {status.kind === "loading" && <StateMessage kind="loading" />}
          {status.kind === "error" && <StateMessage kind="error" message={status.message} />}
          {!selectedUser && usersData && (
            <section className="panel">
              <h2>Most recent users</h2>
              <UsersTable
                users={usersData.users}
                pageSize={applied.pageSize}
                onPageChange={(p) => setApplied((a) => ({ ...a, page: p }))}
                onPageSizeChange={(n) => setApplied((a) => ({ ...a, pageSize: n, page: 1 }))}
                onSelectUser={selectUser}
              />
            </section>
          )}
          {selectedUser && (
            <section className="panel">
              <button type="button" className="link-button" onClick={clearUser}>← Back to users</button>
              <h2>Events for {selectedUser}</h2>
              {userEventsData && (
                <EventsTable
                  events={userEventsData}
                  pageSize={applied.pageSize}
                  onPageChange={(p) => setApplied((a) => ({ ...a, page: p }))}
                  onPageSizeChange={(n) => setApplied((a) => ({ ...a, pageSize: n, page: 1 }))}
                />
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}
