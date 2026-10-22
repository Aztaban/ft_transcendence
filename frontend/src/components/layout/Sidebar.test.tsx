import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import i18n from "../../i18n";
import { RoleProvider } from "../../store/RoleContext";

const currentUser = vi.hoisted(() => ({ roles: [] as string[], isLoaded: false }));

vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));
import Sidebar from "./Sidebar";

const logoutMock = vi.fn();

vi.mock("../../store/AuthContext", () => {
  // Built on each call: mocks are hoisted above `logoutMock`.
  const session = () => ({
    user: {
      id: 1,
      email: "login@example.com",
      display_name: "test-login",
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: logoutMock,
  });

  return { useAuth: session, useOptionalAuth: session };
});

afterEach(() => {
  currentUser.roles = [];
  currentUser.isLoaded = false;
  // The active workspace is kept for the tab; each test starts as a student.
  sessionStorage.clear();
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <RoleProvider>
        <Routes>
          <Route path="/" element={<Sidebar />} />
          <Route path="/login" element={<div>Login after logout</div>} />
        </Routes>
      </RoleProvider>
    </MemoryRouter>,
  );
}

describe("Sidebar logout", () => {
  test("logs out and navigates to the login page", async () => {
    logoutMock.mockResolvedValueOnce(undefined);

    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Login after logout")).toBeDefined();
    });
  });

  test("shows an error toast when logout fails", async () => {
    logoutMock.mockRejectedValueOnce(new Error("Logout failed"));

    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("Logout failed. Please try again.");
  });

  test("removes the error toast automatically", async () => {
    vi.useFakeTimers();
    logoutMock.mockRejectedValueOnce(new Error("Logout failed"));

    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });

    await vi.advanceTimersByTimeAsync(3500);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Sidebar role switcher", () => {
  test("lists only the workspaces of the user's real roles", () => {
    currentUser.roles = ["student", "sc_member"];
    currentUser.isLoaded = true;

    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /STUDENT/ }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "STUDENT",
      "COUNCIL",
    ]);
  });
});

describe("Sidebar language", () => {
  test("shows the navigation in the chosen language", async () => {
    currentUser.roles = ["student", "sc_member"];
    currentUser.isLoaded = true;
    await i18n.changeLanguage("cs");

    renderSidebar();

    const navigation = screen.getByRole("navigation", { name: "Hlavní navigace" });

    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Domů",
      "Žádost",
      "Čekající",
      "Historie",
      "Hitchhikeři",
      "Profil",
      "Studentská rada",
    ]);
    expect(screen.getByRole("button", { name: "Odhlásit se" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /STUDENT/ }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "STUDENT",
      "RADA",
    ]);
  });
});

describe("Sidebar eligibility link", () => {
  function switchToHitchhiker() {
    fireEvent.click(screen.getByRole("button", { name: /STUDENT/ }));
    fireEvent.click(screen.getByRole("option", { name: "HITCHHIKER" }));
  }

  test("shows Eligibility to a Head Tutor in the Hitchhiker workspace", () => {
    currentUser.roles = ["tutor", "head_tutor"];
    currentUser.isLoaded = true;

    renderSidebar();
    switchToHitchhiker();

    expect(screen.getByRole("link", { name: "Eligibility" }).getAttribute("href")).toBe(
      "/eligibility-requests",
    );
  });

  test("hides Eligibility from a Hitchhiker who is not a Head Tutor", () => {
    currentUser.roles = ["tutor"];
    currentUser.isLoaded = true;

    renderSidebar();
    switchToHitchhiker();

    expect(screen.queryByRole("link", { name: "Eligibility" })).toBeNull();
  });
});

describe("Sidebar role menu keyboard", () => {
  function openWithKeyboard() {
    currentUser.roles = ["student", "tutor", "sc_member"];
    currentUser.isLoaded = true;
    renderSidebar();
    const button = screen.getByRole("button", { name: /STUDENT/ });

    button.focus();
    fireEvent.keyDown(button, { key: "ArrowDown" });

    return button;
  }

  test("opens with the arrow key on the current workspace", () => {
    openWithKeyboard();

    expect(document.activeElement?.textContent).toBe("STUDENT");
  });

  test("moves with the arrow keys, Home and End, and wraps around", () => {
    openWithKeyboard();
    const menu = screen.getByRole("listbox");

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("HITCHHIKER");

    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement?.textContent).toBe("COUNCIL");

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("STUDENT");

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement?.textContent).toBe("COUNCIL");

    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement?.textContent).toBe("STUDENT");
  });

  test("closes on Escape and returns to the button", () => {
    const button = openWithKeyboard();

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  test("selects a workspace and returns to the button", () => {
    const button = openWithKeyboard();

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    fireEvent.click(document.activeElement as HTMLElement);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(button.textContent).toBe("HITCHHIKER");
    expect(document.activeElement).toBe(button);
  });
});
