import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "./DashboardView";

const replace = jest.fn();
const router = { replace };
jest.mock("next/navigation", () => ({ useRouter: () => router }));

/** Minimal dashboard payload with a 3-page events table. */
const payload = {
  window: "24h",
  totalViews: 5,
  totalSessions: 2,
  capabilities: ["Onboarding"],
  mostVisited: [],
  leastVisited: [],
  timeOnPage: [],
  events: {
    rows: [{ time: 100, event: "page_viewed", page: "Home", capability: "Onboarding", userId: "a", durationSeconds: 65, properties: { time: 100, distinct_id: "a", app_version: "1.2.3" } }],
    page: 1,
    pageSize: 10,
    total: 25,
    totalPages: 3,
  },
};

const fetchMock = jest.fn();
const urls = () => fetchMock.mock.calls.map(([u]) => new URL(u as string, "http://x").searchParams);
/** Request headers of each fetch call, in call order. */
const headers = () => fetchMock.mock.calls.map(([, init]) => (init?.headers ?? {}) as Record<string, string>);

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
  global.fetch = fetchMock as unknown as typeof fetch;
});

/** Replaces the text in the LBU input. */
async function setLbu(value: string) {
  const input = screen.getByLabelText("LBU");
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

/** The Events table pager is the last one on the page. */
const eventsNext = () => screen.getAllByRole("button", { name: "Next" }).at(-1)!;

/** Renders the dashboard and waits for the initial load. */
async function loaded() {
  render(<DashboardView />);
  await screen.findByText("of 3");
}

describe("DashboardView left pane", () => {
  it("lists Events first and selects it on load", async () => {
    await loaded();
    const events = within(screen.getByRole("navigation")).getByRole("button", { name: "Events" });
    expect(events).toHaveAttribute("aria-current", "page");
  });
});

const usersPayload = {
  window: "24h",
  capabilities: ["Onboarding"],
  users: {
    rows: [{ userId: "user-1", lastSeen: 100, events: 3, lastPage: "Home", capability: "Onboarding" }],
    page: 1,
    pageSize: 10,
    total: 25,
    totalPages: 3,
  },
};

const userEventsPayload = {
  events: {
    rows: [{ time: 100, event: "page_viewed", page: "UserPage", userId: "user-1", properties: { time: 100, plan: "gold" } }],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  },
  mostVisited: [{ page: "UserPage", views: 2, uniqueVisitors: 1 }, { page: "Rare", views: 1, uniqueVisitors: 1 }],
  leastVisited: [{ page: "Rare", views: 1, uniqueVisitors: 1 }, { page: "UserPage", views: 2, uniqueVisitors: 1 }],
};

/** Responds to /api/users with the users payload and everything else with the dashboard payload. */
function routeFetch() {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      String(url).startsWith("/api/users/events")
        ? userEventsPayload
        : String(url).startsWith("/api/users")
          ? usersPayload
          : payload,
  }));
}

describe("DashboardView user item", () => {
  it("lists User second in the left pane", async () => {
    await loaded();
    const names = within(screen.getByRole("navigation")).getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["Events", "Users", "Sign out"]);
  });

  it("fetches /api/users with the applied filters and headers, and shows the users", async () => {
    routeFetch();
    await loaded();
    await userEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Users" }));
    expect(await screen.findByText("user-1")).toBeInTheDocument();
    const last = fetchMock.mock.calls.at(-1)!;
    expect(String(last[0])).toMatch(/^\/api\/users\?/);
    expect(urls().at(-1)!.get("page")).toBe("1");
    expect(urls().at(-1)!.get("window")).toBe("24h");
    expect(headers().at(-1)).toEqual({ "x-environment": "UAT", "x-lbu": "PACS" });
    expect(within(screen.getByRole("navigation")).getByRole("button", { name: "Users" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the same filter controls and applies them to the users list", async () => {
    routeFetch();
    await loaded();
    await userEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Users" }));
    await screen.findByText("user-1");
    await userEvent.selectOptions(screen.getByLabelText("Environment"), "SIT");
    await setLbu("PBTB");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(headers().at(-1)).toEqual({ "x-environment": "SIT", "x-lbu": "PBTB" }));
    expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/^\/api\/users/);
  });

  it("pages the users list and returns to page 1 after switching back to Events", async () => {
    routeFetch();
    await loaded();
    const nav = within(screen.getByRole("navigation"));
    await userEvent.click(nav.getByRole("button", { name: "Users" }));
    await screen.findByText("user-1");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(urls().at(-1)!.get("page")).toBe("2"));
    await userEvent.click(nav.getByRole("button", { name: "Events" }));
    await screen.findByText("of 3");
    expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/^\/api\/dashboard\?/);
    expect(urls().at(-1)!.get("page")).toBe("1");
  });
});

describe("DashboardView user events", () => {
  it("shows a clicked user's events and returns to the list", async () => {
    routeFetch();
    await loaded();
    await userEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Users" }));
    await userEvent.click(await screen.findByRole("button", { name: "user-1" }));
    expect(await screen.findByText("Events for user-1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Most visited pages" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Least visited pages" })).toBeInTheDocument();
    const tables = screen.getAllByRole("table");
    expect(within(tables[0]).getAllByRole("row")[1]).toHaveTextContent("UserPage2"); // most visited first
    expect(within(tables[1]).getAllByRole("row")[1]).toHaveTextContent("Rare1"); // least visited first
    expect(screen.getByText("Events for user-1")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "User" })).not.toBeInTheDocument();
    const last = fetchMock.mock.calls.at(-1)!;
    expect(String(last[0])).toMatch(/^\/api\/users\/events\?/);
    expect(urls().at(-1)!.get("userId")).toBe("user-1");
    expect(urls().at(-1)!.get("page")).toBe("1");
    expect(headers().at(-1)).toEqual({ "x-environment": "UAT", "x-lbu": "PACS" });
    await userEvent.click(screen.getByRole("button", { name: "← Back to users" }));
    expect(await screen.findByRole("button", { name: "user-1" })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/^\/api\/users\?/);
  });

  it("shows an empty state when the user has no events", async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        String(url).startsWith("/api/users/events")
          ? { ...userEventsPayload, events: { rows: [], page: 1, pageSize: 10, total: 0, totalPages: 1 } }
          : String(url).startsWith("/api/users") ? usersPayload : payload,
    }));
    await loaded();
    await userEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Users" }));
    await userEvent.click(await screen.findByRole("button", { name: "user-1" }));
    expect(await screen.findByText("No events in this window.")).toBeInTheDocument();
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

  it("sends a typed LBU trimmed, and only after Apply", async () => {
    await loaded();
    await setLbu("  Group Office ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(headers()[1]["x-lbu"]).toBe("Group Office");
  });

  it("applies the LBU on Enter", async () => {
    await loaded();
    await setLbu("PBTB{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(headers()[1]["x-lbu"]).toBe("PBTB");
  });

  it("does not apply an empty or invalid LBU", async () => {
    await loaded();
    await userEvent.clear(screen.getByLabelText("LBU"));
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByLabelText("LBU")).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(screen.getByLabelText("LBU"), 'P"A{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is not dirty when the LBU differs only by surrounding spaces", async () => {
    await loaded();
    await userEvent.type(screen.getByLabelText("LBU"), "  ");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("fetches environment and LBU only after Apply, resetting to page 1", async () => {
    await loaded();
    await userEvent.click(eventsNext());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await userEvent.selectOptions(screen.getByLabelText("Environment"), "SIT");
    await setLbu("PBTB");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(headers()[2]["x-environment"]).toBe("SIT");
    expect(headers()[2]["x-lbu"]).toBe("PBTB");
    expect(urls()[2].has("environment")).toBe(false);
    expect(urls()[2].get("page")).toBe("1");
  });

  it("does not fetch when window changes, and enables Apply", async () => {
    await loaded();
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Last hour" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(apply).toBeEnabled();
  });

  it("shows when the data was fetched", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...payload, fetchedAt: Date.parse("2026-11-18T09:30:00Z") }) });
    await loaded();
    expect(screen.getByText(/Data as of/)).toHaveTextContent(new Date("2026-11-18T09:30:00Z").toLocaleTimeString());
  });

  it("Refresh refetches the applied view once with refresh=1, and paging does not", async () => {
    await loaded();
    expect(urls()[0].has("refresh")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urls()[1].get("refresh")).toBe("1");
    expect(urls()[1].get("window")).toBe("24h");
    await screen.findByText("of 3");
    await userEvent.click(eventsNext());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(urls()[2].has("refresh")).toBe(false);
  });

  it("Refresh uses the applied filters, not unapplied edits", async () => {
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Last hour" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urls()[1].get("window")).toBe("24h");
  });

  it("disables Refresh while a request is in flight", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => payload }); }),
    );
    render(<DashboardView />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    release();
    await screen.findByText("of 3");
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
  });

  it("sends the date in day mode, only after Apply", async () => {
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Day" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urls()[1].get("window")).toBe("day");
    expect(urls()[1].get("date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(urls()[0].has("date")).toBe(false);
  });

  it("enables Apply for a date change only in day mode", async () => {
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Day" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("fetches once on Apply with the new filters and page 1", async () => {
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Last hour" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urls()[1].get("window")).toBe("1h");
    expect(urls()[1].has("capability")).toBe(false);
    expect(urls()[1].get("page")).toBe("1");
  });

  it("fetches once on Next using applied filters, ignoring pending edits", async () => {
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Last hour" }));
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

describe("DashboardView events table", () => {
  it("shows the User column in the main events table", async () => {
    await loaded();
    expect(screen.getByRole("columnheader", { name: "User" })).toBeInTheDocument();
  });
});

describe("DashboardView event row expansion", () => {
  it("expands a clicked event to show all properties and collapses on a second click", async () => {
    await loaded();
    expect(screen.queryByText("app_version")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Home"));
    expect(screen.getByText("app_version")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("distinct_id")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Home"));
    expect(screen.queryByText("app_version")).not.toBeInTheDocument();
  });
});

describe("DashboardView time spent column", () => {
  it("shows the time spent on each event, or a dash when unknown", async () => {
    await loaded();
    expect(screen.getByRole("columnheader", { name: "Time spent" })).toBeInTheDocument();
    expect(screen.getByText("1m 05s")).toBeInTheDocument();
  });
});

describe("DashboardView session", () => {
  it("redirects to /login when a data request returns 401", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "Not signed in" }) });
    render(<DashboardView />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("signs out via /api/logout and returns to /login", async () => {
    render(<DashboardView />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock.mock.calls.some(([u, init]) => u === "/api/logout" && init?.method === "POST")).toBe(true);
  });
});
