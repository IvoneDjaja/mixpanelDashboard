import { render, screen, fireEvent } from "@testing-library/react";
import { EventsTable } from "./EventsTable";
import type { EventRow } from "@/lib/analytics/dashboard";

const row = { time: 1, event: "page_viewed", userId: "u1", properties: { a: 1 } } as unknown as EventRow;
const events = { rows: [row], total: 1, page: 1, totalPages: 1 } as never;

describe("EventsTable user link", () => {
  it("calls onSelectUser without expanding the row", () => {
    const onSelectUser = jest.fn();
    render(<EventsTable events={events} pageSize={25 as never} onPageChange={jest.fn()} onPageSizeChange={jest.fn()} eventType="" onEventTypeChange={jest.fn()} onSelectUser={onSelectUser} />);
    fireEvent.click(screen.getByRole("button", { name: "u1" }));
    expect(onSelectUser).toHaveBeenCalledWith("u1");
    expect(screen.queryByText("a")).toBeNull();
  });

  it("renders plain text when no handler is given", () => {
    render(<EventsTable events={events} pageSize={25 as never} onPageChange={jest.fn()} onPageSizeChange={jest.fn()} eventType="" onEventTypeChange={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "u1" })).toBeNull();
  });

  it("submits the trimmed event type on Enter", () => {
    const onEventTypeChange = jest.fn();
    render(<EventsTable events={events} pageSize={25 as never} onPageChange={jest.fn()} onPageSizeChange={jest.fn()} eventType="" onEventTypeChange={onEventTypeChange} />);
    const input = screen.getByPlaceholderText("Filter by event type");
    fireEvent.change(input, { target: { value: " click " } });
    expect(onEventTypeChange).not.toHaveBeenCalled();
    fireEvent.submit(input);
    expect(onEventTypeChange).toHaveBeenCalledWith("click");
  });

  it("highlights error_encountered rows only", () => {
    const err = { ...row, event: "error_encountered" } as EventRow;
    const both = { rows: [row, err], total: 2, page: 1, totalPages: 1 } as never;
    render(<EventsTable events={both} pageSize={25 as never} onPageChange={jest.fn()} onPageSizeChange={jest.fn()} eventType="" onEventTypeChange={jest.fn()} />);
    expect(screen.getByText("error_encountered").closest("tr")).toHaveClass("event-error");
    expect(screen.getByText("page_viewed").closest("tr")).not.toHaveClass("event-error");
  });

  it("applies the event type via the Apply button, enabled only when changed", () => {
    const onEventTypeChange = jest.fn();
    render(<EventsTable events={events} pageSize={25 as never} onPageChange={jest.fn()} onPageSizeChange={jest.fn()} eventType="" onEventTypeChange={onEventTypeChange} />);
    const apply = screen.getByRole("button", { name: "Apply event type" });
    expect(apply).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Filter by event type"), { target: { value: "click" } });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(onEventTypeChange).toHaveBeenCalledWith("click");
  });
});
