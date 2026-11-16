import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeftPane } from "./LeftPane";

const items = [
  { id: "events", label: "Events" },
  { id: "other", label: "Other" },
];

describe("LeftPane", () => {
  it("renders every item", () => {
    render(<LeftPane items={items} activeId="events" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Events" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Other" })).toBeInTheDocument();
  });

  it("marks only the active item with aria-current", () => {
    render(<LeftPane items={items} activeId="events" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Events" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Other" })).not.toHaveAttribute("aria-current");
  });

  it("calls onSelect with the item id on click", async () => {
    const onSelect = jest.fn();
    render(<LeftPane items={items} activeId="events" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(onSelect).toHaveBeenCalledWith("other");
  });
});
