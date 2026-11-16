import type { UserRow } from "@/lib/analytics/users";
import type { Page, PageSize } from "@/lib/pagination";
import { Pagination } from "./Pagination";
import { StateMessage } from "./StateMessage";

interface UsersTableProps {
  users: Page<UserRow>;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  /** Called with the user's id when their name is clicked. */
  onSelectUser: (userId: string) => void;
}

/**
 * Server-paginated table of the most recently seen users.
 * @param props - The users page and paging handlers.
 * @returns The users table with a pagination bar, or an empty-state message.
 */
export function UsersTable({ users, pageSize, onPageChange, onPageSizeChange, onSelectUser }: UsersTableProps) {
  if (users.total === 0) return <StateMessage kind="empty" message="No users in this window." />;
  return (
    <>
      <table>
        <thead>
          <tr><th>User</th><th>Last seen</th><th>Events</th><th>Last page</th><th>Function</th><th>Login mode</th></tr>
        </thead>
        <tbody>
          {users.rows.map((u) => (
            <tr key={u.userId}>
              <td>
                <button type="button" className="link-button" onClick={() => onSelectUser(u.userId)}>
                  {u.userId}
                </button>
              </td>
              <td>{new Date(u.lastSeen * 1000).toLocaleString()}</td>
              <td>{u.events}</td>
              <td>{u.lastPage ?? "—"}</td>
              <td>{u.capability ?? "—"}</td>
              <td>{u.signInType ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={users.page}
        totalPages={users.totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}
