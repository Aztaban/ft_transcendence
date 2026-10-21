import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser, updateCurrentUser } from "../api/users";
import type { UserProfile } from "../types/user";
import ProfilePage from "./ProfilePage";

vi.mock("../api/users", () => ({ getCurrentUser: vi.fn(), updateCurrentUser: vi.fn() }));

const lenka: UserProfile = {
  id: 7,
  email: "lenka@example.com",
  display_name: "Lenka Husarova",
  avatar_url: null,
  language: "en",
  roles: [
    { id: 1, name: "student" },
    { id: 2, name: "tutor" },
  ],
  intra_login: null,
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(lenka);
  vi.mocked(updateCurrentUser).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

async function renderPage() {
  const view = render(<ProfilePage />);

  await screen.findByRole("heading", { name: "Lenka Husarova", level: 1 });

  return view;
}

function texts(name: string, selector: string) {
  return Array.from(screen.getByRole("list", { name }).querySelectorAll<HTMLElement>(selector)).map(
    (item) => item.textContent,
  );
}

describe("ProfilePage", () => {
  it("shows the user's initials when they have no avatar", async () => {
    const { container } = await renderPage();

    expect(screen.getByText("LH")).toBeTruthy();
    expect(container.querySelector("img.profile-card__avatar")).toBeNull();
  });

  it("shows the user's avatar when there is one", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...lenka, avatar_url: "/api/v1/files/31/" });
    const { container } = await renderPage();

    expect(container.querySelector("img.profile-card__avatar")?.getAttribute("src")).toBe(
      "/api/v1/files/31/",
    );
  });

  it("shows a colored chip for each role", async () => {
    const { container } = await renderPage();

    expect(texts("Roles", "li")).toEqual(["Student", "Hitchhiker"]);
    expect(container.querySelector(".profile-role--tutor")?.textContent).toBe("Hitchhiker");
  });

  it("shows the account details", async () => {
    await renderPage();

    expect(texts("Account details", ".profile-tile__value")).toEqual([
      "lenka@example.com",
      "English",
      "Email and password",
      "Student, Hitchhiker",
    ]);
  });

  it("shows the 42 login for an account made through 42", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...lenka, intra_login: "lhusarov" });
    await renderPage();

    expect(screen.getByText("42 account · lhusarov")).toBeTruthy();
  });

  it("saves a new display name", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Lenka H." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Profile updated.")).toBeTruthy();
    expect(updateCurrentUser).toHaveBeenCalledWith({ display_name: "Lenka H." });
  });

  it("does not save an empty display name", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("alert").textContent).toBe("Display name is required.");
    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  it("saves the chosen language", async () => {
    await renderPage();
    const languages = screen.getByRole("group", { name: "Language" });

    expect(
      (within(languages).getByRole("radio", { name: /English/ }) as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(within(languages).getByRole("radio", { name: /Czech/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Settings updated.")).toBeTruthy();
    expect(updateCurrentUser).toHaveBeenCalledWith({ language: "cs" });
  });

  it("says when the profile cannot be loaded", async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("network"));
    render(<ProfilePage />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Profile information is currently unavailable.",
    );
  });
});
