import { PAGE_SIZES, isPageSize, type PageSize } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

/**
 * Prev/Next controls, a page number box with an "of Y" label, and a rows-per-page
 * selector. Typing a page number and pressing Enter (or leaving the box) jumps to
 * it; the number is clamped to 1..totalPages, and anything that is not a whole
 * number puts the current page back.
 * @param props - Current paging state and change handlers.
 * @returns The pagination bar.
 */
export function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  /**
   * Applies the number typed into the page box.
   * @param input - The page number input.
   */
  const commit = (input: HTMLInputElement) => {
    const typed = Number(input.value);
    const target = Number.isInteger(typed) && input.value.trim() !== "" ? Math.min(Math.max(typed, 1), totalPages) : page;
    // Show the page actually used, so an out-of-range or invalid entry snaps back.
    input.value = String(target);
    if (target !== page) onPageChange(target);
  };
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
      <label>
        Page{" "}
        <input
          // Remounts when the page changes (Prev/Next, size change), dropping any half-typed value.
          key={page}
          type="number"
          className="page-input"
          aria-label="Page number"
          min={1}
          max={totalPages}
          defaultValue={page}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget);
          }}
          onBlur={(e) => commit(e.currentTarget)}
        />
      </label>
      <span aria-live="polite">of {totalPages}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next</button>
    </div>
  );
}
