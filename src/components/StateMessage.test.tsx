import { render, screen } from "@testing-library/react";
import { StateMessage } from "./StateMessage";

describe("StateMessage", () => {
  it("shows a spinner with the loading text, hidden from assistive technology", () => {
    const { container } = render(<StateMessage kind="loading" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(container.querySelector(".spinner")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows no spinner for empty or error states", () => {
    const { container, rerender } = render(<StateMessage kind="empty" />);
    expect(container.querySelector(".spinner")).toBeNull();
    rerender(<StateMessage kind="error" message="Boom" />);
    expect(container.querySelector(".spinner")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });
});
