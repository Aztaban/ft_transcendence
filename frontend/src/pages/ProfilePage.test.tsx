import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import type { UserProfile } from "../types/user";
import ProfilePage from "./ProfilePage";

// The page reads the shared user and saves through it (#776); the context is faked here.
const current = vi.hoisted(() => ({
  user: null as UserProfile | null,
  loadFailed: false,
  update: vi.fn(),
}));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    user: current.user,
    roles: current.user ? current.user.roles.map((role) => role.name) : [],
    isLoaded: current.user !== null,
    loadFailed: current.loadFailed,
    update: current.update,
  }),
}));

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
  current.user = lenka;
  current.loadFailed = false;
  current.update.mockResolvedValue(undefined);
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
    current.user = { ...lenka, avatar_url: "/avatar.png" };
    const { container } = await renderPage();

    expect(container.querySelector("img.profile-card__avatar")?.getAttribute("src")).toBe(
      "/avatar.png",
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
    current.user = { ...lenka, intra_login: "lhusarov" };
    await renderPage();

    expect(screen.getByText("42 account · lhusarov")).toBeTruthy();
  });

  it("saves a new display name", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Lenka H." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Profile updated.")).toBeTruthy();
    expect(current.update).toHaveBeenCalledWith({ display_name: "Lenka H." });
  });

  it("shows the name the shared user has, so a save reaches the top bar too", async () => {
    const { rerender } = await renderPage();

    // What the context delivers after `update` has re-fetched /users/me/.
    current.user = { ...lenka, display_name: "Lenka H." };
    rerender(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Lenka H.", level: 1 })).toBeTruthy();
  });

  it("shows the save error from the API next to the form", async () => {
    current.update.mockRejectedValue(
      new ApiError(400, "Please correct the fields.", "validation_error", {
        display_name: ["Display name is too long."],
      }),
    );
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Lenka H." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Display name is too long.");
  });

  it("does not save an empty display name", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("alert").textContent).toBe("Display name is required.");
    expect(current.update).not.toHaveBeenCalled();
  });

  // Form validation (#358): 1–64 characters (api-plan §10.2).
  it("does not save a display name over 64 characters", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "a".repeat(65) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Display name must be 64 characters or fewer.",
    );
    expect(current.update).not.toHaveBeenCalled();
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
    expect(current.update).toHaveBeenCalledWith({ language: "cs" });
  });

  // Form validation (#358): the backend's message about the language (api-plan §10.2).
  it("shows the backend's message about the language", async () => {
    current.update.mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields.", "validation_error", {
        language: ['"cs" is not a valid choice.'],
      }),
    );
    await renderPage();

    fireEvent.click(
      within(screen.getByRole("group", { name: "Language" })).getByRole("radio", {
        name: /Czech/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect((await screen.findByRole("alert")).textContent).toBe('"cs" is not a valid choice.');
    expect(screen.queryByText("Settings updated.")).toBeNull();
  });

  it("follows a language saved from the top bar, dropping an unsaved pick", async () => {
    const { rerender } = await renderPage();
    const languages = screen.getByRole("group", { name: "Language" });

    fireEvent.click(within(languages).getByRole("radio", { name: /Czech/ }));

    current.user = { ...lenka, language: "es" };
    rerender(<ProfilePage />);

    expect(
      (within(languages).getByRole("radio", { name: /Spanish/ }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(texts("Account details", ".profile-tile__value")[1]).toBe("Spanish");

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(current.update).toHaveBeenCalledWith({ language: "es" });
  });

  it("shows the save error when the profile was saved but could not be re-fetched", async () => {
    current.update.mockRejectedValue(
      new Error("The profile was saved but could not be re-fetched."),
    );
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Lenka H." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Unable to save profile changes.");
    expect(screen.queryByText("Profile updated.")).toBeNull();
  });

  it("says when the profile cannot be loaded", async () => {
    current.user = null;
    current.loadFailed = true;
    render(<ProfilePage />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Profile information is currently unavailable.",
    );
  });
});
