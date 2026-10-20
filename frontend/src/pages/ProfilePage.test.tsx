import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser } from "../api/users";
import type { UserProfile } from "../types/user";
import ProfilePage from "./ProfilePage";

vi.mock("../api/users", () => ({ getCurrentUser: vi.fn(), updateCurrentUser: vi.fn() }));

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
  cleanup();
  vi.resetAllMocks();
});

describe("ProfilePage avatar", () => {
  it("shows the user's initials when they have no avatar", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(lenka);
    const { container } = render(<ProfilePage />);

    expect(await screen.findByText("LH")).toBeTruthy();
    expect(container.querySelector("img.profile-card__avatar")).toBeNull();
  });

  it("shows the user's avatar when there is one", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...lenka, avatar_url: "/api/v1/files/31/" });
    const { container } = render(<ProfilePage />);

    await screen.findAllByText("Lenka Husarova");

    expect(container.querySelector("img.profile-card__avatar")?.getAttribute("src")).toBe(
      "/api/v1/files/31/",
    );
  });
});
