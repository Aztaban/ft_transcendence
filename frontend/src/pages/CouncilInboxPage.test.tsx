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

function request(pageNumber: number) {
  return { unread: true, page: pageNumber, signal: expect.any(AbortSignal) };
}

function requestedPages() {
  return vi.mocked(listSCMessages).mock.calls.map(([params]) => params?.page);
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
    expect(listSCMessages).toHaveBeenCalledWith(request(1));
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
      screen.getByText("There are no new messages. The ones you have read are in the History."),
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
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      scMessage(30 - index, `Message text ${index}`),
    );

    vi.mocked(listSCMessages).mockImplementation(async ({ page: pageNumber } = {}) =>
      pageNumber === 2
        ? page([scMessage(1, "The oldest one.")], 21)
        : page(firstPage, 21, "https://localhost/api/v1/sc-messages/?unread=true&page=2"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));

    expect(await screen.findByRole("heading", { name: "Message #1" })).toBeTruthy();
    expect(titles()).toHaveLength(21);
    expect(listSCMessages).toHaveBeenLastCalledWith(request(2));
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("asks for the same page again after Show more failed, and says so", async () => {
    vi.mocked(listSCMessages)
      .mockResolvedValueOnce(page([scMessage(4, "First.")], 2, "page-2"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(page([scMessage(3, "Second.")], 2));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load more messages. Please try again.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));

    await screen.findByRole("heading", { name: "Message #3" });
    expect(vi.mocked(listSCMessages).mock.calls.map(([params]) => params?.page)).toEqual([1, 2, 2]);
    expect(titles()).toEqual(["Message #4", "Message #3"]);
  });

  it("keeps loading the next page after a failed background refresh", async () => {
    vi.mocked(listSCMessages)
      .mockResolvedValueOnce(page([scMessage(5, "First.")], 3, "page-2"))
      .mockResolvedValueOnce(page([scMessage(4, "Second.")], 3, "page-3"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(page([scMessage(3, "Third.")], 3));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show more (2 left)" }));
    await screen.findByRole("heading", { name: "Message #4" });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));

    await screen.findByRole("heading", { name: "Message #3" });
    expect(vi.mocked(listSCMessages).mock.calls.map(([params]) => params?.page)).toEqual([
      1, 2, 1, 3,
    ]);
    expect(titles()).toEqual(["Message #5", "Message #4", "Message #3"]);
  });

  it("keeps every page already shown when the list refreshes", async () => {
    vi.mocked(listSCMessages).mockImplementation(async ({ page: pageNumber } = {}) =>
      pageNumber === 2
        ? page([scMessage(5, "Fifth.")], 3, "page-3")
        : page([scMessage(6, "Sixth.")], 3, "page-2"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Show more/ }));
    await screen.findByRole("heading", { name: "Message #5" });
    vi.mocked(listSCMessages).mockClear();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(2));
    expect(requestedPages()).toEqual([1, 2]);
    expect(titles()).toEqual(["Message #6", "Message #5"]);
  });

  it("stops refreshing at the last page when the list has become shorter", async () => {
    vi.mocked(listSCMessages)
      .mockResolvedValueOnce(page([scMessage(6, "Sixth.")], 2, "page-2"))
      .mockResolvedValueOnce(page([scMessage(5, "Fifth.")], 2))
      .mockResolvedValueOnce(page([scMessage(6, "Sixth.")], 1));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Show more/ }));
    await screen.findByRole("heading", { name: "Message #5" });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(titles()).toEqual(["Message #6"]));
    expect(requestedPages()).toEqual([1, 2, 1]);
  });

  describe("when the list refreshes during Show more", () => {
    // Page 2 waits; the test answers it, or sees it cancelled. After that the page answers.
    function waitOnPageTwo() {
      const waiting: { signal?: AbortSignal; fail: (error: Error) => void } = {
        fail: () => {},
      };
      let calls = 0;

      vi.mocked(listSCMessages).mockImplementation(({ page: pageNumber, signal } = {}) => {
        calls += 1;

        if (pageNumber === 2 && calls === 2) {
          waiting.signal = signal;

          return new Promise((_, reject) => {
            waiting.fail = reject;
          });
        }

        return Promise.resolve(
          pageNumber === 2
            ? page([scMessage(5, "Fifth.")], 2)
            : page([scMessage(6, "Sixth.")], 2, "page-2"),
        );
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

    it("cancels the old request and still loads the page that was asked for", async () => {
      const waiting = waitOnPageTwo();

      renderPage();
      await clickShowMoreThenRefresh();

      await waitFor(() => expect(titles()).toEqual(["Message #6", "Message #5"]));
      expect(waiting.signal?.aborted).toBe(true);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("button", { name: "Loading…" })).toBeNull();
    });

    it("shows no error when the old request fails afterwards", async () => {
      const waiting = waitOnPageTwo();

      renderPage();
      await clickShowMoreThenRefresh();
      await waitFor(() => expect(titles()).toEqual(["Message #6", "Message #5"]));

      await act(async () => waiting.fail(new Error("network")));

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("does the same when a new message is notified", async () => {
      const waiting = waitOnPageTwo();
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

      await waitFor(() => expect(titles()).toEqual(["Message #6", "Message #5"]));
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
    expect(listSCMessages).toHaveBeenLastCalledWith(request(1));
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
