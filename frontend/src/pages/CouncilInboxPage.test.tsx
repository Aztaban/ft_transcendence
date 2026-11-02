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
    expect(listSCMessages).toHaveBeenCalledWith({ unread: true, page: 1 });
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
    expect(screen.getByText("There are no new messages.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How the inbox works" })).toBeTruthy();
    // The History page comes with #279; until then nothing links to it.
    expect(screen.queryByRole("link", { name: /History/ })).toBeNull();
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
    expect(listSCMessages).toHaveBeenLastCalledWith({ unread: true, page: 2 });
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
    expect(listSCMessages).toHaveBeenLastCalledWith({ unread: true, page: 1 });
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
