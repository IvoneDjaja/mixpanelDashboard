import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

const setup = (page: number, totalPages: number) => {
  const onPageChange = jest.fn();
  const onPageSizeChange = jest.fn();
  render(<Pagination page={page} totalPages={totalPages} pageSize={10} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />);
  return { onPageChange, onPageSizeChange };
};

describe("Pagination", () => {
  it("shows the page label", () => {
    setup(2, 5);
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
  });
  it("disables Prev on the first page and Next on the last", () => {
    setup(1, 1);
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
  it("calls onPageChange", async () => {
    const { onPageChange } = setup(2, 3);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });
  it("calls onPageSizeChange", async () => {
    const { onPageSizeChange } = setup(1, 3);
    await userEvent.selectOptions(screen.getByLabelText(/rows per page/i), "25");
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});
