import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataFreshness } from "./DataFreshness";

const AT = Date.parse("2026-11-18T09:30:00Z");

describe("DataFreshness", () => {
  it("shows the fetch time", () => {
    render(<DataFreshness fetchedAt={AT} loading={false} onRefresh={jest.fn()} />);
    expect(screen.getByText(/Data as of/)).toHaveTextContent(new Date(AT).toLocaleTimeString());
  });

  it("shows no time before the first load", () => {
    render(<DataFreshness fetchedAt={null} loading onRefresh={jest.fn()} />);
    expect(screen.queryByText(/Data as of/)).toBeNull();
  });

  it("calls onRefresh when clicked", async () => {
    const onRefresh = jest.fn();
    render(<DataFreshness fetchedAt={AT} loading={false} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables Refresh while loading", async () => {
    const onRefresh = jest.fn();
    render(<DataFreshness fetchedAt={AT} loading onRefresh={onRefresh} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  it("shows a spinner only while loading", () => {
    const { container, rerender } = render(<DataFreshness fetchedAt={AT} loading onRefresh={jest.fn()} />);
    expect(container.querySelector(".spinner")).not.toBeNull();
    rerender(<DataFreshness fetchedAt={AT} loading={false} onRefresh={jest.fn()} />);
    expect(container.querySelector(".spinner")).toBeNull();
  });
});
