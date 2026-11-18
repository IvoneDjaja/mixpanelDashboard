/** A single entry in the left pane. */
export interface LeftPaneItem {
  id: string;
  label: string;
}

interface LeftPaneProps {
  items: LeftPaneItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** When provided, a "Sign out" button is shown at the bottom of the pane. */
  onSignOut?: () => void;
}

/**
 * Left navigation pane listing the dashboard's items; the active one is marked
 * with aria-current so it is exposed to assistive technology.
 * @param props - Items to list, the active item id, the selection handler and an optional sign-out handler.
 * @returns The navigation pane.
 */
export function LeftPane({ items, activeId, onSelect, onSignOut }: LeftPaneProps) {
  return (
    <nav className="left-pane" aria-label="Main">
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              className={item.id === activeId ? "active" : undefined}
              aria-current={item.id === activeId ? "page" : undefined}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      {onSignOut && (
        <button type="button" className="sign-out" onClick={onSignOut}>Sign out</button>
      )}
    </nav>
  );
}
