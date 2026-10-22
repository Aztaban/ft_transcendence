import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import type { UserProfile } from "../../types/user";
import LanguageSwitcher from "./LanguageSwitcher";

const current = vi.hoisted(() => ({
  user: null as UserProfile | null,
  refresh: vi.fn(),
}));
const updateCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    user: current.user,
    roles: [],
    isLoaded: true,
    refresh: current.refresh,
  }),
}));
vi.mock("../../api/users", () => ({ updateCurrentUser: updateCurrentUserMock }));

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

  it("switches the page and saves the language of a logged-in user", async () => {
    current.user = lenka;
    updateCurrentUserMock.mockResolvedValue(undefined);
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Čeština" }));

    expect(i18n.language).toBe("cs");
    expect(screen.getByRole("group", { name: "Jazyk" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Čeština" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(updateCurrentUserMock).toHaveBeenCalledWith({ language: "cs" });
    await waitFor(() => expect(current.refresh).toHaveBeenCalledTimes(1));
  });

  it("does not call the API when nobody is logged in", () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Español" }));

    expect(i18n.language).toBe("es");
    expect(updateCurrentUserMock).not.toHaveBeenCalled();
  });

  it("keeps the chosen language when saving fails", async () => {
    current.user = lenka;
    updateCurrentUserMock.mockRejectedValue(new Error("offline"));
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Español" }));

    await waitFor(() => expect(updateCurrentUserMock).toHaveBeenCalledTimes(1));
    expect(i18n.language).toBe("es");
    expect(current.refresh).not.toHaveBeenCalled();
  });
});
