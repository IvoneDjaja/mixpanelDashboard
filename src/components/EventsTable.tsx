import type { EventRow } from "@/lib/analytics/dashboard";
import type { Page, PageSize } from "@/lib/pagination";
import { Pagination } from "./Pagination";
import { StateMessage } from "./StateMessage";

interface EventsTableProps {
  events: Page<EventRow>;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

/**
 * Server-paginated table of raw events, newest first.
 * @param props - The events page and paging handlers.
 * @returns The events table with a pagination bar, or an empty-state message.
 */
export function EventsTable({ events, pageSize, onPageChange, onPageSizeChange }: EventsTableProps) {
  if (events.total === 0) return <StateMessage kind="empty" message="No events in this window." />;
  return (
    <>
      <table>
        <thead><tr><th>Time</th><th>Event</th><th>Page</th><th>Function</th><th>Login mode</th><th>User</th></tr></thead>
        <tbody>
          {events.rows.map((e, i) => (
            <tr key={`${e.time}-${e.userId ?? ""}-${i}`}>
              <td>{new Date(e.time * 1000).toLocaleString()}</td><td>{e.event}</td><td>{e.page ?? "—"}</td>
              <td>{e.capability ?? "—"}</td><td>{e.signInType ?? "—"}</td><td>{e.userId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={events.page}
        totalPages={events.totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}
