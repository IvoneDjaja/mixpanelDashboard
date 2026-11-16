/** A single entry in the left pane. */
export interface LeftPaneItem {
  id: string;
  label: string;
}

interface LeftPaneProps {
  items: LeftPaneItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Left navigation pane listing the dashboard's items; the active one is marked
 * with aria-current so it is exposed to assistive technology.
 * @param props - Items to list, the active item id and the selection handler.
 * @returns The navigation pane.
 */
export function LeftPane({ items, activeId, onSelect }: LeftPaneProps) {
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
    </nav>
  );
}
