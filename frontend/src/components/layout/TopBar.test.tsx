import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import type { UserProfile } from "../../types/user";
import TopBar from "./TopBar";

const current = vi.hoisted(() => ({ user: null as UserProfile | null, unreadCount: 0 }));

vi.mock("./ConnectionStatus", () => ({ default: () => null }));
vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ user: current.user, roles: [], isLoaded: true, refresh: () => {} }),
}));
vi.mock("../../store/NotificationCountContext", () => ({
  useNotificationCount: () => ({ unreadCount: current.unreadCount }),
}));
// The panel has its own tests; here it only needs to be there and to close.
vi.mock("../../features/notifications/NotificationPanel", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <section id="notification-panel" aria-label="Notifications">
      <button type="button" onClick={onClose}>
        Open a notification
      </button>
    </section>
  ),
}));

const lenka: UserProfile = {
  id: 7,
  email: "lenka@example.com",
  display_name: "Lenka Husarova",
  avatar_url: null,
  language: "en",
  roles: [{ id: 1, name: "student" }],
  intra_login: null,
};

afterEach(async () => {
  current.user = null;
  current.unreadCount = 0;
  cleanup();
  await i18n.changeLanguage("en");
});

describe("TopBar user", () => {
  it("shows the logged-in user's name and initials", () => {
    current.user = lenka;
    const { container } = render(<TopBar />);

    expect(screen.getByText("Lenka Husarova")).toBeTruthy();
    expect(screen.getByText("LH")).toBeTruthy();
    expect(container.querySelector("img.topbar__avatar")).toBeNull();
  });

  it("shows the user's avatar when there is one", () => {
    current.user = { ...lenka, avatar_url: "/api/v1/files/31/download/" };
    const { container } = render(<TopBar />);

    expect(container.querySelector("img.topbar__avatar")?.getAttribute("src")).toBe(
      "/api/v1/files/31/download/",
    );
    expect(screen.queryByText("LH")).toBeNull();
  });

  it("shows no name until /users/me/ has answered", () => {
    const { container } = render(<TopBar />);

    expect(container.querySelector(".topbar__username")).toBeNull();
    expect(container.querySelector(".topbar__avatar")?.textContent).toBe("");
  });
});

describe("TopBar notifications", () => {
  it("shows no badge when nothing is unread", () => {
    const { container } = render(<TopBar />);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(container.querySelector(".topbar__notification-badge")).toBeNull();
  });

  it("shows the unread count on the bell", () => {
    current.unreadCount = 3;
    const { container } = render(<TopBar />);

    expect(screen.getByRole("button", { name: "Notifications, 3 unread" })).toBeTruthy();
    expect(container.querySelector(".topbar__notification-badge")?.textContent).toBe("3");
  });

  it("shows 99+ on the badge but the exact count in the label", () => {
    current.unreadCount = 1250;
    const { container } = render(<TopBar />);

    expect(screen.getByRole("button", { name: "Notifications, 1250 unread" })).toBeTruthy();
    expect(container.querySelector(".topbar__notification-badge")?.textContent).toBe("99+");
  });

  it("uses the Czech plural forms in the label", async () => {
    await i18n.changeLanguage("cs");

    const labels = [1, 3, 5].map((count) => {
      current.unreadCount = count;
      const { unmount } = render(<TopBar />);
      const label = screen.getByRole("button", { name: /^Oznámení/ }).getAttribute("aria-label");

      unmount();

      return label;
    });

    expect(labels).toEqual([
      "Oznámení, 1 nepřečtené",
      "Oznámení, 3 nepřečtená",
      "Oznámení, 5 nepřečtených",
    ]);
  });
});

describe("TopBar notification center", () => {
  function bell() {
    return screen.getByRole("button", { name: "Notifications" });
  }

  it("opens and closes the panel with the bell", () => {
    render(<TopBar />);

    expect(bell().getAttribute("aria-expanded")).toBe("false");
    expect(bell().getAttribute("aria-controls")).toBe("notification-panel");
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();

    fireEvent.click(bell());

    expect(bell().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Notifications" })).toBeTruthy();

    fireEvent.click(bell());

    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });

  it("closes on Escape and puts the focus back on the bell", () => {
    render(<TopBar />);
    fireEvent.click(bell());

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
    expect(document.activeElement).toBe(bell());
  });

  it("closes on a click outside, not on a click inside", () => {
    render(<TopBar />);
    fireEvent.click(bell());

    fireEvent.mouseDown(screen.getByRole("region", { name: "Notifications" }));
    expect(screen.getByRole("region", { name: "Notifications" })).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });

  it("closes when a notification is opened", () => {
    render(<TopBar />);
    fireEvent.click(bell());

    fireEvent.click(screen.getByRole("button", { name: "Open a notification" }));

    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });
});
