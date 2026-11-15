import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listSCMessages } from "../api/scMessages";
import i18n from "../i18n";
import type { SCMessage } from "../types/scMessage";
import { LiveContext } from "../websocket/LiveProvider";
import { LiveSocket } from "../websocket/LiveSocket";
import { createFakeSocket, FakeSocket } from "../websocket/testSocket";
import CouncilHistoryPage from "./CouncilHistoryPage";

vi.mock("../api/scMessages", () => ({ listSCMessages: vi.fn() }));

function scMessage(id: number, body: string, readAt: string | null = null): SCMessage {
  return {
    id,
    body,
    read_at: readAt,
    discussion_note: "",
    discussion_note_version: 0,
    created_at: "2026-10-17T08:00:00Z",
  };
}

function page(results: SCMessage[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

afterEach(async () => {
  cleanup();
  vi.resetAllMocks();
  FakeSocket.reset();
  await i18n.changeLanguage("en");
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CouncilHistoryPage />
    </MemoryRouter>,
  );
}

// No `unread` filter: the History shows read and unread messages (api-plan §10.6).
function request(pageSize: number) {
  return { unread: false, pageSize, signal: expect.any(AbortSignal) };
}

// The page sizes asked for: each load asks for the newest N messages (§5.7).
function requestedSizes() {
  return vi.mocked(listSCMessages).mock.calls.map(([params]) => params?.pageSize);
}

// `count` messages, newest (highest id) first; the even ones were read.
function history(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const id = count - index;

    return scMessage(id, `Message text ${id}`, id % 2 === 0 ? "2026-10-18T09:00:00Z" : null);
  });
}

// A fake GET /sc-messages/: answers the newest `pageSize` of `all` (§5.7).
function answer(all: SCMessage[], pageNumber = 1, pageSize = 20) {
  const start = (pageNumber - 1) * pageSize;

  return page(
    all.slice(start, start + pageSize),
    all.length,
    start + pageSize < all.length ? "next" : null,
  );
}

function serve(all: SCMessage[]) {
  vi.mocked(listSCMessages).mockImplementation(
    async ({ page: pageNumber = 1, pageSize = 20 } = {}) => answer(all, pageNumber, pageSize),
  );
}

function titles() {
  return within(screen.getByRole("list", { name: "All messages" }))
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("heading").textContent);
}

describe("CouncilHistoryPage", () => {
  it("lists every message, read or not, with its state and a link to open it", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(
      page([
        scMessage(4, "Quiet study areas, please."),
        scMessage(3, "The fridge is broken.", "2026-10-18T09:00:00Z"),
      ]),
    );

    renderPage();

    expect(document.title).toBe("Message history · 42 Evals");

    expect(screen.getByText("Loading messages…")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Message #4" })).toBeTruthy();
    expect(listSCMessages).toHaveBeenCalledWith(request(20));
    expect(titles()).toEqual(["Message #4", "Message #3"]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Message history2 messages");

    const [unread, read] = within(screen.getByRole("list", { name: "All messages" })).getAllByRole(
      "listitem",
    );

    expect(within(unread).getByText("Unread")).toBeTruthy();
    expect(within(read).getByText("Read 18 October 2026")).toBeTruthy();
    expect(within(read).queryByText("Unread")).toBeNull();
    expect(screen.getByRole("link", { name: "Open message #3" }).getAttribute("href")).toBe(
      "/council/inbox/3",
    );
  });

  it("shows the History tab as open and links the New tab", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(page([scMessage(4, "Quiet study areas, please.")]));

    renderPage();
    await screen.findByRole("heading", { name: "Message #4" });

    const tabs = screen.getByRole("navigation", { name: "Council messages" });

    expect(within(tabs).getByText("History").getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "New" }).getAttribute("href")).toBe(
      "/council/inbox",
    );
  });

  it("says when the council has no messages yet", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(page([]));

    renderPage();

    expect(await screen.findByRole("heading", { name: "No messages yet" })).toBeTruthy();
    expect(screen.getByText("Messages sent to the council will appear here.")).toBeTruthy();
  });

  it("shows an error when the messages cannot be loaded, and loads again on Try again", async () => {
    vi.mocked(listSCMessages).mockRejectedValueOnce(new Error("network"));
    vi.mocked(listSCMessages).mockResolvedValueOnce(page([scMessage(4, "Quiet study areas.")]));

    renderPage();

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText("Could not load the messages. Please try again.")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Loading messages…")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Message #4" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("loads older messages with Show more", async () => {
    serve(history(21));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));

    expect(await screen.findByRole("heading", { name: "Message #1" })).toBeTruthy();
    expect(titles()).toHaveLength(21);
    expect(requestedSizes()).toEqual([20, 40]);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("asks for the same messages again after Show more failed, and says so", async () => {
    const all = history(21);

    vi.mocked(listSCMessages)
      .mockResolvedValueOnce(answer(all, 1, 20))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(answer(all, 1, 40));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load more messages. Please try again.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));

    await screen.findByRole("heading", { name: "Message #1" });
    expect(requestedSizes()).toEqual([20, 40, 40]);
    expect(titles()).toHaveLength(21);
  });

  // A member who scrolled far back keeps their place when the list refreshes.
  it("keeps every message already shown when the list refreshes, in one request", async () => {
    serve(history(30));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show more (10 left)" }));
    await screen.findByRole("heading", { name: "Message #1" });
    vi.mocked(listSCMessages).mockClear();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(1));
    expect(requestedSizes()).toEqual([40]);
    expect(titles()).toHaveLength(30);
  });

  // #676: a refresh cancels a "Show more" still on its way and loads that page itself.
  it("shows no error and frees the button when a refresh replaces Show more", async () => {
    const waiting: { signal?: AbortSignal; fail: (error: Error) => void } = { fail: () => {} };
    const all = history(21);

    vi.mocked(listSCMessages)
      .mockResolvedValueOnce(answer(all, 1, 20))
      .mockImplementationOnce(({ signal } = {}) => {
        waiting.signal = signal;

        return new Promise((_, reject) => {
          waiting.fail = reject;
        });
      })
      .mockResolvedValueOnce(answer(all, 1, 40));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));
    expect(await screen.findByRole("button", { name: "Loading…" })).toBeTruthy();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(titles()).toHaveLength(21));
    await act(async () => waiting.fail(new Error("network")));

    expect(waiting.signal?.aborted).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Loading…" })).toBeNull();
  });

  // The message page reads where it was opened from, so "Back" leads to the History.
  it("opens a message with the History as the way back", async () => {
    function OpenedFrom() {
      const location = useLocation();

      return <p>Opened from {(location.state as { from?: string } | null)?.from}</p>;
    }

    vi.mocked(listSCMessages).mockResolvedValue(page([scMessage(4, "Quiet study areas, please.")]));
    render(
      <MemoryRouter initialEntries={["/council/history"]}>
        <Routes>
          <Route path="/council/history" element={<CouncilHistoryPage />} />
          <Route path="/council/inbox/:id" element={<OpenedFrom />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("link", { name: "Open message #4" }));

    expect(screen.getByText("Opened from /council/history")).toBeTruthy();
  });

  it("loads the messages again when the tab becomes visible", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(page([scMessage(4, "Quiet study areas, please.")]));
    renderPage();
    await screen.findByText("Unread");

    vi.mocked(listSCMessages).mockResolvedValue(
      page([scMessage(4, "Quiet study areas, please.", "2026-10-18T09:00:00Z")]),
    );
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByText("Read 18 October 2026")).toBeTruthy();
    expect(listSCMessages).toHaveBeenCalledTimes(2);
  });

  it("keeps the list when a background refresh fails", async () => {
    vi.mocked(listSCMessages)
      .mockResolvedValueOnce(page([scMessage(4, "Quiet study areas, please.")]))
      .mockRejectedValueOnce(new Error("network"));
    renderPage();
    await screen.findByRole("heading", { name: "Message #4" });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "Message #4" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("re-fetches in the background when a new message is notified", async () => {
    vi.mocked(listSCMessages)
      .mockResolvedValueOnce(page([scMessage(3, "The fridge is broken.")]))
      .mockResolvedValueOnce(
        page([scMessage(5, "New one!"), scMessage(3, "The fridge is broken.")]),
      );

    // An open WebSocket that the test controls like the server.
    const live = new LiveSocket({
      url: "wss://localhost/ws/",
      createSocket: createFakeSocket,
      random: () => 1,
    });

    live.connect();
    FakeSocket.latest().serverOpen();

    render(
      <MemoryRouter>
        <LiveContext.Provider value={live}>
          <CouncilHistoryPage />
        </LiveContext.Provider>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Message #3" });

    act(() => FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 12 } }));

    expect(screen.queryByText("Loading messages…")).toBeNull();
    expect(await screen.findByRole("heading", { name: "Message #5" })).toBeTruthy();
    expect(listSCMessages).toHaveBeenLastCalledWith(request(20));
  });
});

describe("CouncilHistoryPage in another language", () => {
  it("shows the History in Czech, with the Czech plural", async () => {
    await i18n.changeLanguage("cs");
    vi.mocked(listSCMessages).mockResolvedValue(
      page([scMessage(4, "Tiché studovny, prosím."), scMessage(3, "Lednice je rozbitá.")]),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Zpráva č. 4" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Historie zpráv2 zprávy");
    expect(screen.getByRole("link", { name: "Otevřít zprávu č. 4" })).toBeTruthy();
  });
});
