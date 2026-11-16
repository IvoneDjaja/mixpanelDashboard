"use client";

import { useState, type ReactNode } from "react";
import { DEFAULT_PAGE_SIZE, paginate, type PageSize } from "@/lib/pagination";
import { Pagination } from "./Pagination";

interface PaginatedTableProps<T> {
  /** Column header labels. */
  headers: string[];
  /** Full list of rows; paging happens in the browser. */
  rows: T[];
  /** Stable React key for a row. */
  rowKey: (row: T) => string;
  /** Cells (`<td>`s) for a row. */
  renderRow: (row: T) => ReactNode;
}

/**
 * A table that pages through `rows` client-side with its own page state.
 * The page is clamped, so it falls back automatically when `rows` shrinks.
 * @param props - Headers, rows and row renderers.
 * @returns The table with a pagination bar.
 */
export function PaginatedTable<T>({ headers, rows, rowKey, renderRow }: PaginatedTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const view = paginate(rows, page, pageSize);

  return (
    <>
      <table>
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{view.rows.map((r) => <tr key={rowKey(r)}>{renderRow(r)}</tr>)}</tbody>
      </table>
      <Pagination
        page={view.page}
        totalPages={view.totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />
    </>
  );
}
