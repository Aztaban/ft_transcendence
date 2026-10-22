import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "../../types/user";
import TopBar from "./TopBar";

const current = vi.hoisted(() => ({ user: null as UserProfile | null }));

vi.mock("./ConnectionStatus", () => ({ default: () => null }));
vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ user: current.user, roles: [], isLoaded: true, refresh: () => {} }),
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

afterEach(() => {
  current.user = null;
  cleanup();
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
