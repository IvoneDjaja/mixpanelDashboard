import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar, shiftDate, todayUtc, type FilterValues } from "./FilterBar";

const base: FilterValues = { window: "24h", date: todayUtc(), environment: "UAT", lbu: "PACS" };

/** Renders the bar with the given overrides and returns the change handler. */
function setup(values: Partial<FilterValues> = {}) {
  const onChange = jest.fn();
  render(<FilterBar values={{ ...base, ...values }} dirty onChange={onChange} onApply={jest.fn()} />);
  return onChange;
}

describe("shiftDate", () => {
  it("steps across month and year boundaries", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("FilterBar day mode", () => {
  it("offers no 30-day option", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Last 30 days" })).toBeNull();
  });

  it("shows the date controls only in day mode", () => {
    setup();
    expect(screen.queryByLabelText("Date")).toBeNull();
  });

  it("shows the date input in day mode, capped at today", () => {
    setup({ window: "day" });
    expect(screen.getByLabelText("Date")).toHaveAttribute("max", todayUtc());
  });

  it("disables Next day at today but not Previous day", () => {
    setup({ window: "day" });
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous day" })).toBeEnabled();
  });

  it("steps one day back and forward", async () => {
    const onChange = setup({ window: "day", date: "2026-11-10" });
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-11-09" });
    await userEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-11-11" });
  });
});

describe("FilterBar LBU", () => {
  it("is a text input, not a dropdown", () => {
    setup();
    const lbu = screen.getByLabelText("LBU");
    expect(lbu.tagName).toBe("INPUT");
    expect(lbu).toHaveValue("PACS");
  });

  it("reports each edit through onChange", async () => {
    const onChange = setup();
    await userEvent.type(screen.getByLabelText("LBU"), "X");
    expect(onChange).toHaveBeenLastCalledWith({ lbu: "PACSX" });
  });

  it("disables Apply and flags the field for an invalid LBU", () => {
    setup({ lbu: "" });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByLabelText("LBU")).toHaveAttribute("aria-invalid", "true");
  });

  it("enables Apply for a valid, changed LBU", () => {
    setup({ lbu: "PBTB" });
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(screen.getByLabelText("LBU")).toHaveAttribute("aria-invalid", "false");
  });
});
