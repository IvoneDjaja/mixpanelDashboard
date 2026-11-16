import { PAGE_SIZES, isPageSize, type PageSize } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

/**
 * Prev/Next controls, a "Page X of Y" label and a rows-per-page selector.
 * @param props - Current paging state and change handlers.
 * @returns The pagination bar.
 */
export function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  return (
    <div className="pagination">
      <label>
        Rows per page{" "}
        <select
          value={pageSize}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (isPageSize(n)) onPageSizeChange(n);
          }}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Prev</button>
      <span aria-live="polite">Page {page} of {totalPages}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next</button>
    </div>
  );
}
