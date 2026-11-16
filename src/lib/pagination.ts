/** Page sizes a user can choose from. */
export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** Page size used when none is chosen. */
export const DEFAULT_PAGE_SIZE: PageSize = 10;

/** One page of a list plus the paging metadata. */
export interface Page<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Checks whether a number is one of the supported page sizes.
 * @param n - Candidate page size.
 * @returns True when `n` is in PAGE_SIZES.
 */
export function isPageSize(n: number): n is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(n);
}

/**
 * Slices a list into one page. The requested page is clamped into the valid
 * range, and an empty list still reports one (empty) page.
 * @param items - Full list.
 * @param page - Requested 1-based page number.
 * @param pageSize - Rows per page.
 * @returns The rows for the page and paging metadata.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  return { rows: items.slice(start, start + pageSize), page: current, pageSize, total, totalPages };
}
