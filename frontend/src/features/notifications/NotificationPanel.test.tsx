import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listNotifications } from "../../api/notifications";
import type { Notification } from "../../types/notification";
import NotificationPanel from "./NotificationPanel";

vi.mock("../../api/notifications", () => ({ listNotifications: vi.fn() }));

function page(results: Notification[]) {
  return { count: results.length, next: null, previous: null, results };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("NotificationPanel", () => {
  it("shows that it is loading until the server answers", () => {
    vi.mocked(listNotifications).mockReturnValue(new Promise(() => {}));

    render(<NotificationPanel />);

    expect(screen.getByRole("region", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("Loading notifications…")).toBeTruthy();
    expect(listNotifications).toHaveBeenCalledTimes(1);
  });

  it("says when there are no notifications", async () => {
    vi.mocked(listNotifications).mockResolvedValue(page([]));

    render(<NotificationPanel />);

    expect(await screen.findByText("No notifications yet.")).toBeTruthy();
    expect(screen.queryByText("Loading notifications…")).toBeNull();
  });

  it("shows an error and loads again on Try again", async () => {
    vi.mocked(listNotifications)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(page([]));

    render(<NotificationPanel />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load your notifications.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No notifications yet.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(listNotifications).toHaveBeenCalledTimes(2);
  });
});
