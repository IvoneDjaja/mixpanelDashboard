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
    const input = screen.getByLabelText(/event type/i);
    fireEvent.change(input, { target: { value: " click " } });
    expect(onEventTypeChange).not.toHaveBeenCalled();
    fireEvent.submit(input);
    expect(onEventTypeChange).toHaveBeenCalledWith("click");
  });
});
