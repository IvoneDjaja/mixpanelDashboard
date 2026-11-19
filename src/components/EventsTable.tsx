import { Fragment, useState } from "react";
import { fmtSeconds } from "@/lib/formatDuration";
import type { EventRow } from "@/lib/analytics/dashboard";
import type { Page, PageSize } from "@/lib/pagination";
import { Pagination } from "./Pagination";
import { StateMessage } from "./StateMessage";

interface EventsTableProps {
  events: Page<EventRow>;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  /** Whether to show the User column; hidden when every row belongs to one user. Defaults to true. */
  showUser?: boolean;
  /** When provided, the User cell is a button that calls this with the user's id. */
  onSelectUser?: (userId: string) => void;
  /** The applied event type filter (empty for none). */
  eventType: string;
  /** Called with the trimmed text when the user submits the event type filter. */
  onEventTypeChange: (eventType: string) => void;
}

/**
 * Formats a property value for display.
 * @param value - Any JSON value from an event's properties.
 * @returns The value as text; objects and arrays are pretty-printed JSON.
 */
function formatValue(value: unknown): string {
  if (value !== null && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Server-paginated table of raw events, newest first. Clicking a row selects it and
 * shows all of the event's properties in a panel beside the table.
 * @param props - The events page and paging handlers.
 * @returns The events table with a pagination bar, or an empty-state message.
 */
export function EventsTable({ events, pageSize, onPageChange, onPageSizeChange, showUser = true, onSelectUser, eventType, onEventTypeChange }: EventsTableProps) {
  // Text being typed; applied on Enter so each keystroke doesn't trigger a request.
  const [draft, setDraft] = useState(eventType);
  // Remembers which row of which page is selected; a different page of rows shows nothing selected.
  const [selected, setSelected] = useState<{ rows: EventRow[]; index: number } | null>(null);
  const filter = (
    <form
      className="controls"
      onSubmit={(f) => {
        f.preventDefault();
        if (draft.trim() !== eventType) onEventTypeChange(draft.trim());
      }}
    >
      <label>
        Event type{" "}
        <input
          type="text"
          value={draft}
          maxLength={100}
          placeholder="Filter by event type"
          onChange={(c) => setDraft(c.target.value)}
        />
      </label>
      <button type="submit" className="apply-button" aria-label="Apply event type" disabled={draft.trim() === eventType}>
        Apply
      </button>
    </form>
  );
  if (events.total === 0) {
    return (
      <>
        {filter}
        <StateMessage kind="empty" message={eventType ? "No events match this event type." : "No events in this window."} />
      </>
    );
  }
  const selectedIndex = selected && selected.rows === events.rows ? selected.index : null;
  const selectedEvent = selectedIndex === null ? null : events.rows[selectedIndex];
  /** Selects row `i`, or clears the selection when it is already selected. */
  const toggle = (i: number) => setSelected(selectedIndex === i ? null : { rows: events.rows, index: i });
  return (
    <>
      {filter}
      <div className="events-layout">
      <div className="events-main">
      <table>
        <thead><tr><th>Time</th><th>Event</th><th>Page</th><th>Time spent</th>{showUser && <th>User</th>}</tr></thead>
        <tbody>
          {events.rows.map((e, i) => {
            const open = selectedIndex === i;
            return (
              <Fragment key={`${e.time}-${e.userId ?? ""}-${i}`}>
                <tr
                  className={`event-row${e.event === "error_encountered" ? " event-error" : ""}${open ? " event-selected" : ""}`}
                  tabIndex={0}
                  aria-selected={open}
                  onClick={() => toggle(i)}
                  onKeyDown={(k) => {
                    if (k.key === "Enter" || k.key === " ") {
                      k.preventDefault();
                      toggle(i);
                    }
                  }}
                >
                  <td>{new Date(e.time * 1000).toLocaleString()}</td><td>{e.event}</td><td>{e.page ?? "—"}</td>
                  <td>{e.durationSeconds === undefined ? "—" : fmtSeconds(e.durationSeconds)}</td>
                  {showUser && (
                    <td>
                      {e.userId && onSelectUser ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={(c) => {
                            c.stopPropagation();
                            onSelectUser(e.userId as string);
                          }}
                          onKeyDown={(k) => k.stopPropagation()}
                        >
                          {e.userId}
                        </button>
                      ) : (
                        (e.userId ?? "—")
                      )}
                    </td>
                  )}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <Pagination
        page={events.page}
        totalPages={events.totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
      </div>
      <aside className="event-panel" aria-label="Event properties">
        <h3>Event properties</h3>
        {selectedEvent ? (
          <dl>
            {Object.entries(selectedEvent.properties).map(([key, value]) => (
              <Fragment key={key}>
                <dt>{key}</dt>
                <dd>{formatValue(value)}</dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <p className="event-panel-empty">Select an event to view its properties.</p>
        )}
      </aside>
      </div>
    </>
  );
}
