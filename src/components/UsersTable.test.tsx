import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersTable } from "./UsersTable";

const users = {
  rows: [{ userId: "user-1", lastSeen: 100, events: 3, lastPage: "Home", capability: "Onboarding", signInType: "Singpass" }],
  page: 1,
  pageSize: 10,
  total: 1,
  totalPages: 1,
};

describe("UsersTable", () => {
  it("calls onSelectUser with the user id when a user is clicked", async () => {
    const onSelectUser = jest.fn();
    render(<UsersTable users={users} pageSize={10} onPageChange={jest.fn()} onPageSizeChange={jest.fn()} onSelectUser={onSelectUser} />);
    await userEvent.click(screen.getByRole("button", { name: "user-1" }));
    expect(onSelectUser).toHaveBeenCalledWith("user-1");
  });
});
