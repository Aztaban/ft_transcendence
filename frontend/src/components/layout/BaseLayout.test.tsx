import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import BaseLayout from "./BaseLayout";

vi.mock("./ConnectionStatus", () => ({ default: () => null }));

vi.mock("../../store/AuthContext", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ user: null, roles: ["student"], isLoaded: true, refresh: () => {} }),
}));

vi.mock("../../store/RoleContext", () => ({
  useRole: () => ({ activeRole: "STUDENT", setActiveRole: vi.fn(), availableRoles: ["STUDENT"] }),
}));

afterEach(() => {
  cleanup();
});

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="*"
          element={
            <BaseLayout>
              <p>Page content</p>
            </BaseLayout>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function getSidebar() {
  return document.getElementById("app-sidebar") as HTMLElement;
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
}

describe("BaseLayout sidebar drawer", () => {
  it("opens from the menu button and moves the focus to the first link", () => {
    renderLayout();
    const button = screen.getByRole("button", { name: "Open menu" });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("app-sidebar");
    expect(getSidebar().className).toBe("sidebar");

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Close menu");
    expect(getSidebar().className).toBe("sidebar sidebar--open");
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Home" }));
  });

  it("closes with Escape and gives the focus back to the menu button", () => {
    renderLayout();
    openMenu();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(getSidebar().className).toBe("sidebar");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open menu" }));
  });

  it("closes when the dimmed page behind it is clicked", () => {
    renderLayout();
    openMenu();

    fireEvent.click(screen.getByTestId("sidebar-backdrop"));

    expect(getSidebar().className).toBe("sidebar");
    expect(screen.queryByTestId("sidebar-backdrop")).toBeNull();
  });

  it("closes after a page is chosen", () => {
    renderLayout();
    openMenu();

    fireEvent.click(screen.getByRole("link", { name: "Request" }));

    expect(screen.getByRole("link", { name: "Request" }).className).toBe(
      "sidebar__nav-link sidebar__nav-link--active",
    );
    expect(getSidebar().className).toBe("sidebar");
  });
});
