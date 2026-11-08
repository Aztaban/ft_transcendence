import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listSCMessages } from "../api/scMessages";
import i18n from "../i18n";
import type { SCMessage } from "../types/scMessage";
import { LiveContext } from "../websocket/LiveProvider";
import { LiveSocket } from "../websocket/LiveSocket";
import { createFakeSocket, FakeSocket } from "../websocket/testSocket";
import CouncilInboxPage from "./CouncilInboxPage";

vi.mock("../api/scMessages", () => ({ listSCMessages: vi.fn() }));

function scMessage(id: number, body: string): SCMessage {
  return {
    id,
    body,
    read_at: null,
    discussion_note: "",
    discussion_note_version: 0,
    created_at: "2026-10-17T08:00:00Z",
  };
}

function page(results: SCMessage[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  FakeSocket.reset();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CouncilInboxPage />
    </MemoryRouter>,
  );
}

function request(pageSize: number) {
  return { unread: true, pageSize, signal: expect.any(AbortSignal) };
}

// The page sizes asked for: each load asks for the newest N messages (§5.7).
function requestedSizes() {
  return vi.mocked(listSCMessages).mock.calls.map(([params]) => params?.pageSize);
}

// `count` messages, newest (highest id) first.
function inbox(count: number) {
  return Array.from({ length: count }, (_, index) =>
    scMessage(count - index, `Message text ${count - index}`),
  );
}

// A fake GET /sc-messages/: answers the newest `pageSize` of `all` (§5.7).
function serve(all: SCMessage[]) {
  vi.mocked(listSCMessages).mockImplementation(
    async ({ page: pageNumber = 1, pageSize = 20 } = {}) => answer(all, pageNumber, pageSize),
  );
}

function answer(all: SCMessage[], pageNumber = 1, pageSize = 20) {
  const start = (pageNumber - 1) * pageSize;

  return page(
    all.slice(start, start + pageSize),
    all.length,
    start + pageSize < all.length ? "next" : null,
  );
}

function titles() {
  return within(screen.getByRole("list", { name: "New messages" }))
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("heading").textContent);
}

describe("CouncilInboxPage", () => {
  it("lists the unread messages with their first lines and a link to read them", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(
      page([scMessage(4, "Quiet study areas, please."), scMessage(3, "The fridge is broken.")]),
    );

    renderPage();

    expect(screen.getByText("Loading messages…")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Message #4" })).toBeTruthy();
    expect(listSCMessages).toHaveBeenCalledWith(request(20));
    expect(document.title).toBe("Messages · 42 Evals");
    expect(titles()).toEqual(["Message #4", "Message #3"]);
    expect(screen.getByText("Quiet study areas, please.")).toBeTruthy();
    expect(screen.getByText("2 new")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read message #3" }).getAttribute("href")).toBe(
      "/council/inbox/3",
    );
  });

  it("says when everything is read and explains the inbox", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(page([]));

    renderPage();

    expect(await screen.findByRole("heading", { name: "All caught up!" })).toBeTruthy();
    expect(
      screen.getByText(
        "There are no new messages. Messages that have been read are in the History.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How the inbox works" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open History" }).getAttribute("href")).toBe(
      "/council/history",
    );
  });

  // #279: the tabs switch between the new messages and the History.
  it("shows the New tab as open and links the History tab", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(page([scMessage(4, "Quiet study areas, please.")]));

    renderPage();
    await screen.findByRole("heading", { name: "Message #4" });

    const tabs = screen.getByRole("navigation", { name: "Council messages" });

    expect(within(tabs).getByText("New").getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "History" }).getAttribute("href")).toBe(
      "/council/history",
    );
  });

  it("loads the messages again when the tab becomes visible", async () => {
    vi.mocked(listSCMessages).mockResolvedValue(page([scMessage(4, "Quiet study areas, please.")]));
    renderPage();
    await screen.findByRole("heading", { name: "Message #4" });

    vi.mocked(listSCMessages).mockResolvedValue(page([]));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByRole("heading", { name: "All caught up!" })).toBeTruthy();
    expect(listSCMessages).toHaveBeenCalledTimes(2);
  });

  it("shows an error when the messages cannot be loaded", async () => {
    vi.mocked(listSCMessages).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the messages. Please try again later.",
    );
  });

  it("loads older messages with Show more", async () => {
    serve(inbox(21));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));

    expect(await screen.findByRole("heading", { name: "Message #1" })).toBeTruthy();
    expect(titles()).toHaveLength(21);
    expect(requestedSizes()).toEqual([20, 40]);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("asks for the same messages again after Show more failed, and says so", async () => {
    const all = inbox(21);

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

  it("keeps loading more after a failed background refresh", async () => {
    const all = inbox(45);
    let calls = 0;

    vi.mocked(listSCMessages).mockImplementation(async ({ pageSize = 20 } = {}) => {
      calls += 1;

      if (calls === 3) {
        throw new Error("network");
      }

      return answer(all, 1, pageSize);
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show more (25 left)" }));
    await screen.findByRole("heading", { name: "Message #6" });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole("button", { name: "Show more (5 left)" }));

    await screen.findByRole("heading", { name: "Message #1" });
    expect(requestedSizes()).toEqual([20, 40, 40, 60]);
    expect(titles()).toHaveLength(45);
  });

  it("keeps every message already shown when the list refreshes, in one request", async () => {
    serve(inbox(30));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Show more/ }));
    await screen.findByRole("heading", { name: "Message #1" });
    vi.mocked(listSCMessages).mockClear();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(1));
    expect(requestedSizes()).toEqual([40]);
    expect(titles()).toHaveLength(30);
  });

  it("shows the shorter list when messages were read meanwhile", async () => {
    serve(inbox(30));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Show more/ }));
    await screen.findByRole("heading", { name: "Message #1" });

    serve(inbox(30).slice(0, 10));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(titles()).toHaveLength(10));
    expect(requestedSizes()).toEqual([20, 40, 40]);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  describe("when the list refreshes during Show more", () => {
    // The "Show more" request waits; the test fails it, or sees it cancelled. The rest answer.
    function waitOnShowMore() {
      const waiting: { signal?: AbortSignal; fail: (error: Error) => void } = {
        fail: () => {},
      };
      const all = inbox(21);
      let calls = 0;

      vi.mocked(listSCMessages).mockImplementation(({ pageSize = 20, signal } = {}) => {
        calls += 1;

        if (calls === 2) {
          waiting.signal = signal;

          return new Promise((_, reject) => {
            waiting.fail = reject;
          });
        }

        return Promise.resolve(answer(all, 1, pageSize));
      });

      return waiting;
    }

    async function clickShowMoreThenRefresh() {
      fireEvent.click(await screen.findByRole("button", { name: /Show more/ }));
      expect(await screen.findByRole("button", { name: "Loading…" })).toBeTruthy();

      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }

    it("cancels the old request and still loads the messages that were asked for", async () => {
      const waiting = waitOnShowMore();

      renderPage();
      await clickShowMoreThenRefresh();

      await waitFor(() => expect(titles()).toHaveLength(21));
      expect(waiting.signal?.aborted).toBe(true);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("button", { name: "Loading…" })).toBeNull();
    });

    it("shows no error when the old request fails afterwards", async () => {
      const waiting = waitOnShowMore();

      renderPage();
      await clickShowMoreThenRefresh();
      await waitFor(() => expect(titles()).toHaveLength(21));

      await act(async () => waiting.fail(new Error("network")));

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("does the same when a new message is notified", async () => {
      const waiting = waitOnShowMore();
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
            <CouncilInboxPage />
          </LiveContext.Provider>
        </MemoryRouter>,
      );

      fireEvent.click(await screen.findByRole("button", { name: /Show more/ }));
      await screen.findByRole("button", { name: "Loading…" });

      act(() =>
        FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 12 } }),
      );

      await waitFor(() => expect(titles()).toHaveLength(21));
      expect(waiting.signal?.aborted).toBe(true);
    });
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
          <CouncilInboxPage />
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

describe("CouncilInboxPage in another language", () => {
  it("shows the inbox in Spanish", async () => {
    await i18n.changeLanguage("es");
    vi.mocked(listSCMessages).mockResolvedValue(
      page([scMessage(4, "Zonas de estudio tranquilas.")]),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Mensaje n.º 4" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mensajes1 nuevos");
    expect(screen.getByRole("link", { name: "Leer el mensaje n.º 4" })).toBeTruthy();
  });
});
