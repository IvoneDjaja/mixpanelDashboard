import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "./DashboardView";

/** Minimal dashboard payload with a 3-page events table. */
const payload = {
  window: "24h",
  totalViews: 5,
  totalSessions: 2,
  capabilities: ["Onboarding"],
  mostVisited: [],
  leastVisited: [],
  timeOnPage: [],
  paths: [],
  loginModes: [],
  events: {
    rows: [{ time: 100, event: "page_viewed", page: "Home", capability: "Onboarding", userId: "a" }],
    page: 1,
    pageSize: 10,
    total: 25,
    totalPages: 3,
  },
  latencyAvailable: false,
};

const fetchMock = jest.fn();
const urls = () => fetchMock.mock.calls.map(([u]) => new URL(u as string, "http://x").searchParams);
/** Request headers of each fetch call, in call order. */
const headers = () => fetchMock.mock.calls.map(([, init]) => (init?.headers ?? {}) as Record<string, string>);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
  global.fetch = fetchMock as unknown as typeof fetch;
});

/** The Events table pager is the last one on the page. */
const eventsNext = () => screen.getAllByRole("button", { name: "Next" }).at(-1)!;

/** Renders the dashboard and waits for the initial load. */
async function loaded() {
  render(<DashboardView />);
  await screen.findByText("Page 1 of 3");
}

describe("DashboardView left pane", () => {
  it("lists Events first and selects it on load", async () => {
    await loaded();
    const events = within(screen.getByRole("navigation")).getByRole("button", { name: "Events" });
    expect(events).toHaveAttribute("aria-current", "page");
  });
});

describe("DashboardView fetching", () => {
  it("fetches exactly once on mount", async () => {
    await loaded();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls()[0].get("window")).toBe("24h");
    expect(urls()[0].get("page")).toBe("1");
    expect(urls()[0].get("pageSize")).toBe("10");
  });

  it("sends the default environment and LBU on mount", async () => {
    await loaded();
    expect(headers()[0]["x-environment"]).toBe("UAT");
    expect(headers()[0]["x-lbu"]).toBe("PACS");
    expect(urls()[0].has("environment")).toBe(false);
    expect(urls()[0].has("lbu")).toBe(false);
  });

  it("fetches environment and LBU only after Apply, resetting to page 1", async () => {
    await loaded();
    await userEvent.click(eventsNext());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await userEvent.selectOptions(screen.getByLabelText("Environment"), "SIT");
    await userEvent.selectOptions(screen.getByLabelText("LBU"), "PBTB");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(headers()[2]["x-environment"]).toBe("SIT");
    expect(headers()[2]["x-lbu"]).toBe("PBTB");
    expect(urls()[2].has("environment")).toBe(false);
    expect(urls()[2].get("page")).toBe("1");
  });

  it("does not fetch when window or function change, and enables Apply", async () => {
    await loaded();
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    await userEvent.selectOptions(screen.getByLabelText("Function"), "Onboarding");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(apply).toBeEnabled();
  });

  it("fetches once on Apply with the new filters and page 1", async () => {
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    await userEvent.selectOptions(screen.getByLabelText("Function"), "Onboarding");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urls()[1].get("window")).toBe("30d");
    expect(urls()[1].get("capability")).toBe("Onboarding");
    expect(urls()[1].get("page")).toBe("1");
  });

  it("fetches once on Next using applied filters, ignoring pending edits", async () => {
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    await userEvent.click(eventsNext());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urls()[1].get("page")).toBe("2");
    expect(urls()[1].get("window")).toBe("24h");
  });

  it("fetches once on page-size change and resets to page 1", async () => {
    await loaded();
    await userEvent.click(eventsNext());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await userEvent.selectOptions(screen.getAllByLabelText(/rows per page/i).at(-1)!, "25");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(urls()[2].get("pageSize")).toBe("25");
    expect(urls()[2].get("page")).toBe("1");
  });
});
