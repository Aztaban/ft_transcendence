import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import type { UserProfile } from "../../types/user";
import LanguageSwitcher from "./LanguageSwitcher";

const current = vi.hoisted(() => ({
  user: null as UserProfile | null,
  update: vi.fn(),
}));

// The language is saved through the shared user, which re-fetches itself (#776).
vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    user: current.user,
    roles: [],
    isLoaded: true,
    loadFailed: false,
    update: current.update,
  }),
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
  vi.clearAllMocks();
});

describe("LanguageSwitcher", () => {
  it("marks the current language", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["true", "false", "false"]);
  });

  it("does nothing for the language already shown", () => {
    current.user = lenka;
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    // Switching stores the choice for this browser; nothing was switched.
    expect(window.localStorage.getItem("language")).toBeNull();
    expect(i18n.language).toBe("en");
    expect(current.update).not.toHaveBeenCalled();
  });

  it("switches the page and saves the language of a logged-in user", async () => {
    current.user = lenka;
    current.update.mockResolvedValue(undefined);
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Čeština" }));

    expect(i18n.language).toBe("cs");
    expect(screen.getByRole("group", { name: "Jazyk" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Čeština" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(current.update).toHaveBeenCalledWith({ language: "cs" });
  });

  it("does not save a language the shared user already has", () => {
    current.user = { ...lenka, language: "cs" };
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Čeština" }));

    expect(i18n.language).toBe("cs");
    expect(current.update).not.toHaveBeenCalled();
  });

  it("does not call the API when nobody is logged in", () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Español" }));

    expect(i18n.language).toBe("es");
    expect(current.update).not.toHaveBeenCalled();
  });

  it("keeps the chosen language when saving fails", async () => {
    current.user = lenka;
    current.update.mockRejectedValue(new Error("offline"));
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Español" }));

    await waitFor(() => expect(current.update).toHaveBeenCalledTimes(1));
    expect(i18n.language).toBe("es");
  });
});
