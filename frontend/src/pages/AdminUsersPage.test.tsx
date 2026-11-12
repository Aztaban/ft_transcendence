import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminUsers } from "../api/admin";
import type { AdminUser } from "../types/adminUser";
import AdminUsersPage from "./AdminUsersPage";

vi.mock("../api/admin", () => ({ listAdminUsers: vi.fn() }));

function adminUser(id: number, name: string, extra: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    email: `${name.toLowerCase()}@example.com`,
    display_name: name,
    avatar_url: null,
    language: "en",
    roles: [{ id: 1, name: "student" }],
    intra_login: null,
    status: "active",
    created_at: "2026-10-01T08:00:00Z",
    last_login: "2026-11-02T09:30:00Z",
    ...extra,
  };
}

function page(results: AdminUser[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

// The names link to the user pages, so the page needs a router.
function renderPage() {
  return render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>,
  );
}

// The parameters of each listAdminUsers call, in order.
function requests() {
  return vi.mocked(listAdminUsers).mock.calls.map(([params]) => params);
}

const noFilters = { q: undefined, role: undefined, status: undefined };

beforeEach(() => {
  vi.mocked(listAdminUsers).mockResolvedValue(page([]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminUsersPage", () => {
  it("lists the users with translated roles and status", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue(
      page([
        adminUser(1, "Anna", {
          roles: [
            { id: 1, name: "student" },
            { id: 2, name: "tutor" },
          ],
        }),
        adminUser(2, "Boris", { status: "suspended", last_login: null }),
        adminUser(3, "Deleted user", {
          email: "deleted-3@example.com",
          status: "deleted",
          roles: [],
        }),
      ]),
    );

    renderPage();

    const table = await screen.findByRole("table", { name: "Users" });
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );

    expect(rows).toEqual([
      ["Anna", "anna@example.com", "Student, Hitchhiker", "Active", "2 November 2026"],
      ["Boris", "boris@example.com", "Student", "Suspended", "Never"],
      ["Deleted user", "deleted-3@example.com", "—", "Deleted", "2 November 2026"],
    ]);
    expect(within(table).getByRole("link", { name: "Anna" }).getAttribute("href")).toBe(
      "/manage/users/1",
    );
    expect(requests()).toEqual([{ ...noFilters, page: 1 }]);
    expect(document.title).toBe("Users · 42 Evals");
  });

  it("searches only when the form is submitted", async () => {
    renderPage();
    await screen.findByText("No users yet");

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "  ann  " } });

    expect(requests()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("No users match these filters")).toBeTruthy();
    expect(requests()).toEqual([
      { ...noFilters, page: 1 },
      { ...noFilters, q: "ann", page: 1 },
    ]);
  });

  it("filters by role and status, starting again from the first page", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue(
      page([adminUser(1, "Anna")], 45, "/api/v1/admin/users/?page=2"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await screen.findByText("Page 2 of 3");

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "tutor" } });
    await screen.findByText("Page 1 of 3");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "suspended" } });
    await screen.findByRole("table");

    expect(requests()).toEqual([
      { ...noFilters, page: 1 },
      { ...noFilters, page: 2 },
      { ...noFilters, role: "tutor", page: 1 },
      { ...noFilters, role: "tutor", status: "suspended", page: 1 },
    ]);
    expect(
      within(screen.getByLabelText("Role"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All roles", "Student", "Hitchhiker", "Head Tutor", "Student Council", "Admin"]);
  });

  it("pages through the users", async () => {
    vi.mocked(listAdminUsers)
      .mockResolvedValueOnce(page([adminUser(1, "Anna")], 21, "/api/v1/admin/users/?page=2"))
      .mockResolvedValueOnce(page([adminUser(21, "Zoe")], 21, null));

    renderPage();

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Previous/ }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(await screen.findByText("Zoe")).toBeTruthy();
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Next/ }).hasAttribute("disabled")).toBe(true);
    expect(requests()).toEqual([
      { ...noFilters, page: 1 },
      { ...noFilters, page: 2 },
    ]);
  });

  // #369: the rows stay until the next page arrives, so the button just used keeps the focus.
  it("keeps the users and the focus on Next while the next page loads", async () => {
    let answer: (value: ReturnType<typeof page>) => void = () => {};

    vi.mocked(listAdminUsers)
      .mockResolvedValueOnce(page([adminUser(1, "Anna")], 41, "?page=2"))
      .mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
      .mockResolvedValueOnce(page([adminUser(41, "Zoe")], 41, null));

    renderPage();

    const next = await screen.findByRole("button", { name: /Next/ });

    next.focus();
    fireEvent.click(next);

    expect(screen.getByText("Anna")).toBeTruthy();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    expect(screen.getByRole("table").parentElement?.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(next);

    await act(async () => answer(page([adminUser(21, "Mia")], 41, "?page=3")));

    expect(screen.queryByText("Anna")).toBeNull();
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.getByRole("table").parentElement?.getAttribute("aria-busy")).toBe("false");
    expect(document.activeElement).toBe(next);

    // A quick second click on the last page asks for nothing past it.
    fireEvent.click(next);
    fireEvent.click(next);

    expect(await screen.findByText("Zoe")).toBeTruthy();
    expect(requests().map((params) => params?.page)).toEqual([1, 2, 3]);
  });

  it("shows no page buttons when everything fits on one page", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue(page([adminUser(1, "Anna")]));

    renderPage();

    expect(await screen.findByText("Anna")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "User pages" })).toBeNull();
  });

  it("shows an error when the users cannot be loaded", async () => {
    vi.mocked(listAdminUsers).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We couldn't load the users. Please try again later.",
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});
