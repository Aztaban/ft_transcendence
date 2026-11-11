import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAuditLog } from "../api/audit";
import i18n from "../i18n";
import { RoleProvider } from "../store/RoleContext";
import type { AuditEntry } from "../types/audit";
import AuditLogPage from "./AuditLogPage";

// The user's real roles from /users/me/: an Admin unless a test says otherwise.
const currentUser = vi.hoisted(() => ({ roles: ["student", "admin"], isLoaded: true }));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));
vi.mock("../api/audit", () => ({ listAuditLog: vi.fn() }));

const roleAssigned: AuditEntry = {
  id: 120,
  actor: { id: 1, display_name: "Admin", avatar_url: null },
  action: "role.assigned",
  target_type: "user",
  target_id: 42,
  reason: "",
  metadata: { role: "tutor" },
  created_at: "2026-11-05T10:00:00Z",
};

const userEdited: AuditEntry = {
  id: 119,
  actor: null,
  action: "user.updated",
  target_type: "user",
  target_id: 7,
  reason: "",
  metadata: {
    old: { display_name: "a", email: "a@x.cz" },
    new: { display_name: "b", email: "b@x.cz" },
  },
  created_at: "2026-11-04T09:00:00Z",
};

const messageDeleted: AuditEntry = {
  id: 118,
  actor: { id: 1, display_name: "Admin", avatar_url: null },
  action: "sc_message.deleted",
  target_type: "sc_message",
  target_id: 3,
  reason: "Insults.",
  metadata: {},
  created_at: "2026-11-03T08:00:00Z",
};

function page(results: AuditEntry[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

beforeEach(() => {
  vi.mocked(listAuditLog).mockResolvedValue(page([roleAssigned, userEdited, messageDeleted]));
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
  vi.resetAllMocks();
  currentUser.roles = ["student", "admin"];
  currentUser.isLoaded = true;
});

function Url() {
  const location = useLocation();

  return <output data-testid="url">{location.search}</output>;
}

function renderPage(path = "/manage/audit-log") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RoleProvider>
        <Routes>
          <Route
            path="/manage/audit-log"
            element={
              <>
                <AuditLogPage />
                <Url />
              </>
            }
          />
        </Routes>
      </RoleProvider>
    </MemoryRouter>,
  );
}

function rows(name = "Audit entries") {
  return within(screen.getByRole("table", { name })).getAllByRole("row").slice(1);
}

function lastQuery() {
  return vi.mocked(listAuditLog).mock.lastCall?.[0];
}

function url() {
  return screen.getByTestId("url").textContent;
}

describe("AuditLogPage", () => {
  it("lists who did what, to which target and why, with translated words", async () => {
    renderPage();

    await screen.findByRole("table", { name: "Audit entries" });

    expect(document.title).toBe("Audit log · 42 Evals");
    expect(screen.getByText("3 entries")).toBeTruthy();
    expect(rows().map((row) => within(row).getAllByRole("cell")[2].textContent)).toEqual([
      "Role assigned",
      "Account edited",
      "Council message deleted",
    ]);

    const [assigned, edited, deleted] = rows();

    expect(within(assigned).getByText("Role: Hitchhiker")).toBeTruthy();
    expect(within(assigned).getByRole("link", { name: "Open User #42" }).getAttribute("href")).toBe(
      "/manage/users/42",
    );
    expect(within(edited).getByText("A deleted account")).toBeTruthy();
    expect(within(edited).getByText("Changed: display name, email")).toBeTruthy();
    expect(within(deleted).getByText("Insults.")).toBeTruthy();
    // A deleted council message has no page to open.
    expect(within(deleted).queryByRole("link")).toBeNull();
    expect(lastQuery()).toEqual({
      action: undefined,
      targetType: undefined,
      targetId: undefined,
      actor: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
  });

  it("is only for Admins and asks the API nothing for anyone else", async () => {
    currentUser.roles = ["student", "head_tutor"];
    renderPage();

    expect(await screen.findByText("ACCESS RESTRICTED")).toBeTruthy();
    expect(listAuditLog).not.toHaveBeenCalled();
  });

  it("filters by action and target type, and keeps them in the URL", async () => {
    renderPage();
    await screen.findByRole("table");

    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "role.assigned" },
    });
    await waitFor(() => expect(lastQuery()?.action).toBe("role.assigned"));

    fireEvent.change(screen.getByRole("combobox", { name: "Target" }), {
      target: { value: "user" },
    });
    await waitFor(() => expect(lastQuery()?.targetType).toBe("user"));
    expect(url()).toBe("?action=role.assigned&target_type=user");
  });

  it("sends a date range as whole days with a time zone", async () => {
    renderPage("/manage/audit-log?from=2026-11-01&to=2026-11-06");
    await screen.findByRole("table");

    expect(lastQuery()?.from).toBe(new Date("2026-11-01T00:00:00").toISOString());
    expect(lastQuery()?.to).toBe(new Date("2026-11-06T23:59:59.999").toISOString());
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-11-01");
  });

  it("shows only one person's actions or one target's entries after a click, and clears it", async () => {
    renderPage();
    await screen.findByRole("table");

    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Admin" }));
    await waitFor(() => expect(lastQuery()?.actor).toBe(1));
    expect(url()).toBe("?actor=1");

    fireEvent.click(await screen.findByRole("button", { name: "Remove the filter by Admin" }));
    await waitFor(() => expect(url()).toBe(""));

    fireEvent.click(
      within((await screen.findAllByRole("row"))[1]).getByRole("button", { name: "User #42" }),
    );
    await waitFor(() => expect(lastQuery()).toMatchObject({ targetType: "user", targetId: 42 }));
    expect(screen.getByRole("button", { name: "Remove the filter on User #42" })).toBeTruthy();
  });

  it("goes to the next page and back to page 1 when a filter changes", async () => {
    vi.mocked(listAuditLog).mockResolvedValue(page([roleAssigned], 45, "next"));
    renderPage();
    await screen.findByText("Page 1 of 3");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(lastQuery()?.page).toBe(2));
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(url()).toBe("?page=2");

    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    await waitFor(() => expect(url()).toBe(""));
    fireEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await screen.findByText("Page 2 of 3");

    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "user.deleted" },
    });
    await waitFor(() => expect(lastQuery()).toMatchObject({ action: "user.deleted", page: 1 }));
  });

  it("says when nothing matches and clears the filters", async () => {
    vi.mocked(listAuditLog).mockResolvedValue(page([]));
    renderPage("/manage/audit-log?action=user.deleted");

    expect(
      await screen.findByRole("heading", { name: "No entries match these filters" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(url()).toBe(""));
  });

  it("shows an error and loads again on Try again", async () => {
    vi.mocked(listAuditLog)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(page([roleAssigned]));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not load the audit log.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("table")).toBeTruthy();
  });

  it("shows the log in Czech, with the Czech plural", async () => {
    await i18n.changeLanguage("cs");
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Auditní záznam" })).toBeTruthy();
    expect(await screen.findByText("3 záznamy")).toBeTruthy();
    expect(within(rows("Auditní záznamy")[0]).getByText("Role přidělena")).toBeTruthy();
  });
});
