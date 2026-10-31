import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications";
import type { Notification } from "../../types/notification";
import { LiveContext } from "../../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../../websocket/testSocket";
import NotificationPanel from "./NotificationPanel";

vi.mock("../../api/notifications", () => ({
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

// The bell's count as the panel sees it: a test sets `unreadCount` before rendering, and a
// `refresh` implementation can change it, as the provider does after the server answers.
const count = vi.hoisted(() => ({ unreadCount: 0, refresh: vi.fn() }));

vi.mock("../../store/NotificationCountContext", () => ({
  useNotificationCount: () => ({ unreadCount: count.unreadCount, refresh: count.refresh }),
}));

const libft = { id: 4, slug: "libft", name: "Libft" };

const created: Notification = {
  id: 12,
  type: "evaluation.created",
  payload: { request_id: 17, project: libft },
  target_url: "/evaluations/17",
  read_at: null,
  created_at: "2026-10-24T09:00:00Z",
};

const deleted: Notification = {
  id: 11,
  type: "resource.deleted",
  payload: { title: "Libft tips" },
  target_url: "",
  read_at: "2026-10-23T10:00:00Z",
  created_at: "2026-10-23T09:00:00Z",
};

function page(results: Notification[]) {
  return { count: results.length, next: null, previous: null, results };
}

function renderPanel(onClose = vi.fn()) {
  const live = openLiveSocket();

  render(
    <LiveContext.Provider value={live}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<NotificationPanel onClose={onClose} />} />
          <Route path="/evaluations/:id" element={<p>Evaluation page</p>} />
        </Routes>
      </MemoryRouter>
    </LiveContext.Provider>,
  );

  return onClose;
}

beforeEach(() => {
  FakeSocket.reset();
  count.unreadCount = 0;
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("NotificationPanel", () => {
  it("shows that it is loading until the server answers", () => {
    vi.mocked(listNotifications).mockReturnValue(new Promise(() => {}));

    renderPanel();

    expect(screen.getByRole("region", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("Loading notifications…")).toBeTruthy();
    expect(listNotifications).toHaveBeenCalledTimes(1);
  });

  it("says when there are no notifications", async () => {
    vi.mocked(listNotifications).mockResolvedValue(page([]));

    renderPanel();

    expect(await screen.findByText("No notifications yet.")).toBeTruthy();
    expect(screen.queryByText("Loading notifications…")).toBeNull();
  });

  it("shows an error and loads again on Try again", async () => {
    vi.mocked(listNotifications)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(page([]));

    renderPanel();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load your notifications.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No notifications yet.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(listNotifications).toHaveBeenCalledTimes(2);
  });

  it("lists the sentences, marks the unread ones and links to their page", async () => {
    vi.mocked(listNotifications).mockResolvedValue(page([created, deleted]));

    renderPanel();

    const items = await screen.findAllByRole("listitem");

    expect(items.map((item) => item.className)).toEqual([
      "notification-panel__item notification-panel__item--unread",
      "notification-panel__item",
    ]);
    expect(within(items[0]).getByRole("link").getAttribute("href")).toBe("/evaluations/17");
    expect(within(items[0]).getByText("Unread")).toBeTruthy();
    expect(within(items[0]).getByText("New evaluation request for Libft")).toBeTruthy();
    expect(items[0].querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-24T09:00:00Z");

    expect(within(items[1]).queryByRole("link")).toBeNull();
    expect(within(items[1]).queryByText("Unread")).toBeNull();
    expect(within(items[1]).getByText('Your resource "Libft tips" was deleted')).toBeTruthy();
  });

  it("opens the notification's page and closes", async () => {
    vi.mocked(listNotifications).mockResolvedValue(
      page([{ ...created, read_at: deleted.read_at }]),
    );
    const onClose = renderPanel();

    fireEvent.click(await screen.findByRole("link", { name: /New evaluation request for Libft/ }));

    expect(screen.getByText("Evaluation page")).toBeTruthy();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("re-fetches the list on notification.created", async () => {
    vi.mocked(listNotifications)
      .mockResolvedValueOnce(page([deleted]))
      .mockResolvedValueOnce(page([created, deleted]));

    renderPanel();
    await screen.findByText('Your resource "Libft tips" was deleted');

    act(() => FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 12 } }));

    expect(await screen.findByText("New evaluation request for Libft")).toBeTruthy();
    expect(listNotifications).toHaveBeenCalledTimes(2);
  });

  it("keeps the list when a live re-fetch fails", async () => {
    vi.mocked(listNotifications)
      .mockResolvedValueOnce(page([created]))
      .mockRejectedValueOnce(new Error("network"));

    renderPanel();
    await screen.findByText("New evaluation request for Libft");

    act(() => FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 13 } }));

    await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(2));
    expect(screen.getByText("New evaluation request for Libft")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("marks an unread notification as read when its page is opened", async () => {
    vi.mocked(listNotifications).mockResolvedValue(page([created]));
    vi.mocked(markNotificationRead).mockResolvedValue({
      ...created,
      read_at: "2026-10-24T10:00:00Z",
    });
    const onClose = renderPanel();

    fireEvent.click(await screen.findByRole("link", { name: /New evaluation request for Libft/ }));

    expect(markNotificationRead).toHaveBeenCalledWith(12);
    expect(screen.getByText("Evaluation page")).toBeTruthy();
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(count.refresh).toHaveBeenCalledTimes(1));
  });

  it("marks an unread notification without a page as read on a click", async () => {
    const unreadDeleted: Notification = { ...deleted, read_at: null };

    vi.mocked(listNotifications).mockResolvedValue(page([unreadDeleted]));
    vi.mocked(markNotificationRead).mockResolvedValue(deleted);
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: /Your resource "Libft tips" was deleted/ }),
    );

    await waitFor(() =>
      expect(screen.getByRole("listitem").className).toBe("notification-panel__item"),
    );
    expect(markNotificationRead).toHaveBeenCalledWith(11);
    expect(count.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Libft tips/ })).toBeNull();
  });

  it("sends nothing for a notification that is already read", async () => {
    vi.mocked(listNotifications).mockResolvedValue(
      page([{ ...created, read_at: deleted.read_at }]),
    );
    renderPanel();

    fireEvent.click(await screen.findByRole("link", { name: /New evaluation request for Libft/ }));

    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(count.refresh).not.toHaveBeenCalled();
  });

  it("keeps a notification unread when marking it fails", async () => {
    const unreadDeleted: Notification = { ...deleted, read_at: null };

    vi.mocked(listNotifications).mockResolvedValue(page([unreadDeleted]));
    vi.mocked(markNotificationRead).mockRejectedValue(new Error("network"));
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: /Your resource "Libft tips" was deleted/ }),
    );

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("listitem").className).toBe(
      "notification-panel__item notification-panel__item--unread",
    );
    expect(count.refresh).not.toHaveBeenCalled();
  });

  it("offers Mark all as read only when something is unread", async () => {
    vi.mocked(listNotifications).mockResolvedValue(page([deleted]));

    renderPanel();
    await screen.findByText('Your resource "Libft tips" was deleted');

    expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull();
  });

  // #674: the list holds only the newest page, so unread notifications can all be older ones.
  it("offers Mark all as read when only notifications outside the list are unread", async () => {
    count.unreadCount = 3;
    vi.mocked(listNotifications).mockResolvedValue(
      page([{ ...created, read_at: "2026-10-24T10:00:00Z" }, deleted]),
    );

    renderPanel();
    await screen.findByText('Your resource "Libft tips" was deleted');

    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeTruthy();
    expect(screen.queryByText("Unread")).toBeNull();
  });

  it("hides Mark all as read once the badge count is back to 0", async () => {
    count.unreadCount = 3;
    // Like the provider: the count loaded again after "Mark all as read" is 0.
    count.refresh.mockImplementation(() => {
      count.unreadCount = 0;
    });
    vi.mocked(listNotifications).mockResolvedValue(page([deleted]));
    vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull(),
    );
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(count.refresh).toHaveBeenCalledTimes(1);
  });

  it("marks all as read, then loads the list and the badge again", async () => {
    let finish = () => {};

    vi.mocked(listNotifications)
      .mockResolvedValueOnce(page([created, deleted]))
      .mockResolvedValueOnce(page([{ ...created, read_at: "2026-10-24T10:00:00Z" }, deleted]));
    vi.mocked(markAllNotificationsRead).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));

    expect(
      (screen.getByRole("button", { name: "Mark all as read" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => finish());

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull(),
    );
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(listNotifications).toHaveBeenCalledTimes(2);
    expect(count.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Unread")).toBeNull();
  });

  it("keeps the list and enables the button again when marking all fails", async () => {
    vi.mocked(listNotifications).mockResolvedValue(page([created]));
    vi.mocked(markAllNotificationsRead).mockRejectedValue(new Error("network"));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));

    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Mark all as read" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.getByText("Unread")).toBeTruthy();
    expect(listNotifications).toHaveBeenCalledTimes(1);
    expect(count.refresh).not.toHaveBeenCalled();
  });

  it("loads the list again on notification.updated", async () => {
    vi.mocked(listNotifications)
      .mockResolvedValueOnce(page([created]))
      .mockResolvedValueOnce(page([{ ...created, read_at: "2026-10-24T10:00:00Z" }]));

    renderPanel();
    await screen.findByText("Unread");

    act(() => FakeSocket.latest().serverSend({ event: "notification.updated", data: {} }));

    await waitFor(() => expect(screen.queryByText("Unread")).toBeNull());
    expect(listNotifications).toHaveBeenCalledTimes(2);
  });
});
