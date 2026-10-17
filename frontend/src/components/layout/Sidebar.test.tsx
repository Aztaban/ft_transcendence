import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { RoleProvider } from "../../store/RoleContext";

const currentUser = vi.hoisted(() => ({ roles: [] as string[], isLoaded: false }));

vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));
import Sidebar from "./Sidebar";

const logoutMock = vi.fn();

vi.mock("../../store/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "login@example.com",
      display_name: "test-login",
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: logoutMock,
  }),
}));

afterEach(() => {
  currentUser.roles = [];
  currentUser.isLoaded = false;
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
