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
    expect(screen.getByLabelText("Page number")).toHaveValue(2);
    expect(screen.getByText("of 5")).toBeInTheDocument();
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

  describe("page number box", () => {
    /** Replaces the box's text with `value`. */
    const typeInto = async (value: string) => {
      const box = screen.getByLabelText("Page number");
      await userEvent.clear(box);
      if (value) await userEvent.type(box, value);
      return box;
    };

    it("jumps to the typed page on Enter", async () => {
      const { onPageChange } = setup(1, 12);
      await typeInto("7");
      await userEvent.keyboard("{Enter}");
      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(7);
    });

    it("jumps when the box loses focus", async () => {
      const { onPageChange } = setup(1, 12);
      await typeInto("4");
      await userEvent.tab();
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it("clamps a number above the last page and below the first", async () => {
      const { onPageChange } = setup(2, 5);
      const box = await typeInto("99");
      await userEvent.keyboard("{Enter}");
      expect(onPageChange).toHaveBeenLastCalledWith(5);
      expect(box).toHaveValue(5);
      await typeInto("0");
      await userEvent.keyboard("{Enter}");
      expect(onPageChange).toHaveBeenLastCalledWith(1);
    });

    it("puts the current page back for an empty or fractional entry, without jumping", async () => {
      const { onPageChange } = setup(3, 5);
      const box = await typeInto("");
      await userEvent.keyboard("{Enter}");
      expect(box).toHaveValue(3);
      await typeInto("2.5");
      await userEvent.keyboard("{Enter}");
      expect(box).toHaveValue(3);
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("does not jump when the page is unchanged, and stays at 1 on a single page", async () => {
      const { onPageChange } = setup(1, 1);
      const box = await typeInto("1");
      await userEvent.keyboard("{Enter}");
      await typeInto("5");
      await userEvent.keyboard("{Enter}");
      expect(box).toHaveValue(1);
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });
});
