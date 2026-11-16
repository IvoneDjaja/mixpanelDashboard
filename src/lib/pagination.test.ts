import { isPageSize, paginate } from "./pagination";

const items = Array.from({ length: 25 }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the first page", () => {
    expect(paginate(items, 1, 10)).toMatchObject({ rows: items.slice(0, 10), page: 1, total: 25, totalPages: 3 });
  });
  it("returns a short last page", () => {
    expect(paginate(items, 3, 10).rows).toEqual([21, 22, 23, 24, 25]);
  });
  it("clamps pages out of range", () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate(items, NaN, 10).page).toBe(1);
  });
  it("handles an empty list", () => {
    expect(paginate([], 1, 10)).toMatchObject({ rows: [], page: 1, total: 0, totalPages: 1 });
  });
  it("has no extra page on an exact multiple", () => {
    expect(paginate(items.slice(0, 20), 1, 10).totalPages).toBe(2);
  });
});

describe("isPageSize", () => {
  it("accepts only supported sizes", () => {
    expect(isPageSize(25)).toBe(true);
    expect(isPageSize(7)).toBe(false);
  });
});
