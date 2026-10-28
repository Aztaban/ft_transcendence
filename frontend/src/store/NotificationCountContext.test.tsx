import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUnreadCount } from "../api/notifications";
import { LiveContext } from "../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../websocket/testSocket";
import { NotificationCountProvider, useNotificationCount } from "./NotificationCountContext";

vi.mock("../api/notifications", () => ({ getUnreadCount: vi.fn() }));

const session = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: session.isAuthenticated }),
}));

function Probe() {
  const { unreadCount } = useNotificationCount();

  return <p>unread: {unreadCount}</p>;
}

function renderWithSocket() {
  const live = openLiveSocket();

  return render(
    <LiveContext.Provider value={live}>
      <NotificationCountProvider>
        <Probe />
      </NotificationCountProvider>
    </LiveContext.Provider>,
  );
}

beforeEach(() => {
  FakeSocket.reset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
  session.isAuthenticated = true;
});

describe("NotificationCountProvider", () => {
  it("loads the unread count once logged in", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue({ count: 3 });

    renderWithSocket();

    expect(await screen.findByText("unread: 3")).toBeTruthy();
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
  });

  it("does not ask for the count when nobody is logged in", () => {
    session.isAuthenticated = false;

    renderWithSocket();

    expect(screen.getByText("unread: 0")).toBeTruthy();
    expect(getUnreadCount).not.toHaveBeenCalled();
  });

  it("re-fetches the count on notification.created", async () => {
    vi.mocked(getUnreadCount)
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 4 });

    renderWithSocket();
    await screen.findByText("unread: 3");

    act(() => FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 9 } }));

    expect(await screen.findByText("unread: 4")).toBeTruthy();
    expect(getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it("re-fetches the count after a reconnect", async () => {
    vi.mocked(getUnreadCount)
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 5 });

    renderWithSocket();
    await screen.findByText("unread: 3");

    vi.useFakeTimers();
    act(() => FakeSocket.latest().serverClose(1006));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    vi.useRealTimers();
    act(() => FakeSocket.latest().serverOpen());

    expect(await screen.findByText("unread: 5")).toBeTruthy();
    expect(getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it("keeps the last count when the request fails", async () => {
    vi.mocked(getUnreadCount)
      .mockResolvedValueOnce({ count: 3 })
      .mockRejectedValueOnce(new Error("network"));

    renderWithSocket();
    await screen.findByText("unread: 3");

    act(() => FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 9 } }));

    await waitFor(() => expect(getUnreadCount).toHaveBeenCalledTimes(2));
    expect(screen.getByText("unread: 3")).toBeTruthy();
  });

  it("goes back to 0 on logout", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue({ count: 3 });

    const view = renderWithSocket();
    await screen.findByText("unread: 3");

    session.isAuthenticated = false;
    view.rerender(
      <LiveContext.Provider value={null}>
        <NotificationCountProvider>
          <Probe />
        </NotificationCountProvider>
      </LiveContext.Provider>,
    );

    await waitFor(() => expect(screen.getByText("unread: 0")).toBeTruthy());
  });

  it("is 0 without a provider", () => {
    render(<Probe />);

    expect(screen.getByText("unread: 0")).toBeTruthy();
  });
});
