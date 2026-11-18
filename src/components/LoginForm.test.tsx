import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

const replace = jest.fn();
const router = { replace };
jest.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

/** Fills the four fields and submits. */
async function submit() {
  await userEvent.type(screen.getByLabelText("Service account user"), "svc");
  await userEvent.type(screen.getByLabelText("Service account secret"), "s3cret");
  await userEvent.type(screen.getByLabelText("Project ID"), "123");
  await userEvent.selectOptions(screen.getByLabelText("Region"), "us");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm", () => {
  it("renders the four fields with a masked secret", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Service account secret")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Region")).toHaveValue("eu");
    expect(screen.getByLabelText("Project ID")).toBeInTheDocument();
  });

  it("posts the credentials and navigates home on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    render(<LoginForm />);
    await submit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/login");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      user: "svc", secret: "s3cret", projectId: "123", region: "us",
    });
  });

  it("shows the server error and stays on the page", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Mixpanel rejected these credentials" }) });
    render(<LoginForm />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Mixpanel rejected these credentials");
    expect(replace).not.toHaveBeenCalled();
  });
});
