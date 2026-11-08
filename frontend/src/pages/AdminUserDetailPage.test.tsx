import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteAdminUser,
  getAdminUser,
  reactivateAdminUser,
  suspendAdminUser,
  updateAdminUser,
} from "../api/admin";
import { ApiError } from "../api/client";
import type { AdminUser } from "../types/adminUser";
import AdminUserDetailPage from "./AdminUserDetailPage";

vi.mock("../api/admin", () => ({
  getAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  suspendAdminUser: vi.fn(),
  reactivateAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
}));

// The logged-in Admin; a test sets `id` to the edited user's to edit their own account.
const me = vi.hoisted(() => ({ id: 99, refresh: vi.fn() }));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    user: { id: me.id },
    roles: ["student", "admin"],
    isLoaded: true,
    refresh: me.refresh,
  }),
}));

function adminUser(extra: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 1,
    email: "anna@example.com",
    display_name: "Anna",
    avatar_url: null,
    language: "en",
    roles: [
      { id: 1, name: "student" },
      { id: 2, name: "tutor" },
    ],
    intra_login: null,
    status: "active",
    created_at: "2026-10-01T08:00:00Z",
    last_login: "2026-11-02T09:30:00Z",
    ...extra,
  };
}

function renderAt(id = "1") {
  return render(
    <MemoryRouter initialEntries={[`/manage/users/${id}`]}>
      <Routes>
        <Route path="/manage/users/:id" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function input(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function saveButton() {
  return screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.mocked(getAdminUser).mockResolvedValue(adminUser());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  me.id = 99;
});

describe("AdminUserDetailPage", () => {
  it("shows the account and fills the form with it", async () => {
    renderAt();

    expect(await screen.findByRole("heading", { level: 1, name: "Anna" })).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();

    const details = screen
      .getAllByRole("term")
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

    expect(details).toEqual([
      ["Email", "anna@example.com"],
      ["42 login", "—"],
      ["Language", "English"],
      ["Roles", "Student, Hitchhiker"],
      ["Account created", "1 October 2026"],
      ["Last login", "2 November 2026"],
    ]);
    expect(input("Display name").value).toBe("Anna");
    expect(input("Email").value).toBe("anna@example.com");
    expect(input("Language").value).toBe("en");
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByRole("link", { name: /All users/ }).getAttribute("href")).toBe(
      "/manage/users",
    );
    expect(getAdminUser).toHaveBeenCalledWith(1);
    // The title is set by an effect that runs just after the heading appears.
    await waitFor(() => expect(document.title).toBe("Anna · 42 Evals"));
  });

  it("sends only the changed fields, trimmed", async () => {
    vi.mocked(updateAdminUser).mockResolvedValue(
      adminUser({ display_name: "Anna Novak", language: "cs" }),
    );
    renderAt();

    fireEvent.change(await screen.findByLabelText("Display name"), {
      target: { value: "  Anna Novak  " },
    });
    fireEvent.change(input("Language"), { target: { value: "cs" } });
    fireEvent.click(saveButton());

    expect((await screen.findByRole("status")).textContent).toBe("Changes saved.");
    expect(updateAdminUser).toHaveBeenCalledWith(1, { display_name: "Anna Novak", language: "cs" });
    expect(screen.getByRole("heading", { level: 1, name: "Anna Novak" })).toBeTruthy();
    expect(input("Display name").value).toBe("Anna Novak");
    expect(saveButton().disabled).toBe(true);
    expect(me.refresh).not.toHaveBeenCalled();
  });

  it("refreshes the current user after an Admin edits their own account", async () => {
    me.id = 1;
    vi.mocked(updateAdminUser).mockResolvedValue(adminUser({ language: "es" }));
    renderAt();

    fireEvent.change(await screen.findByLabelText("Language"), { target: { value: "es" } });
    fireEvent.click(saveButton());

    await screen.findByRole("status");
    expect(me.refresh).toHaveBeenCalledTimes(1);
  });

  it("checks the required fields before sending", async () => {
    renderAt();

    fireEvent.change(await screen.findByLabelText("Display name"), { target: { value: "   " } });
    fireEvent.change(input("Email"), { target: { value: "" } });
    fireEvent.click(saveButton());

    expect(screen.getByText("Display name is required.").id).toBe("admin-user-name-error");
    expect(screen.getByText("Email is required.").id).toBe("admin-user-email-error");
    expect(input("Display name").getAttribute("aria-invalid")).toBe("true");
    expect(input("Display name").getAttribute("aria-describedby")).toBe("admin-user-name-error");
    expect(updateAdminUser).not.toHaveBeenCalled();
  });

  it("shows a taken email next to the email field", async () => {
    vi.mocked(updateAdminUser).mockRejectedValue(
      new ApiError(409, "An account with this email already exists.", "email_already_exists"),
    );
    renderAt();

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "boris@example.com" },
    });
    fireEvent.click(saveButton());

    expect((await screen.findByText("Another account already uses this email.")).id).toBe(
      "admin-user-email-error",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the backend's field messages next to their fields", async () => {
    vi.mocked(updateAdminUser).mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields.", "validation_error", {
        email: ["Enter a valid email address."],
      }),
    );
    renderAt();

    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.click(saveButton());

    expect((await screen.findByText("Enter a valid email address.")).id).toBe(
      "admin-user-email-error",
    );
    expect(updateAdminUser).toHaveBeenCalledWith(1, { email: "not-an-email" });
  });

  it("loads the account again when it was deleted meanwhile", async () => {
    vi.mocked(updateAdminUser).mockRejectedValue(
      new ApiError(409, "Deleted accounts cannot be edited.", "invalid_user_status"),
    );
    renderAt();

    fireEvent.change(await screen.findByLabelText("Display name"), { target: { value: "New" } });
    vi.mocked(getAdminUser).mockResolvedValue(adminUser({ status: "deleted", roles: [] }));
    fireEvent.click(saveButton());

    expect(
      await screen.findByText("This account was deleted. Deleted accounts cannot be edited."),
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(
      "This account was deleted in the meantime, so the changes were not saved.",
    );
    expect(screen.queryByRole("form")).toBeNull();
    expect(getAdminUser).toHaveBeenCalledTimes(2);
  });

  it("shows a deleted account without the form", async () => {
    vi.mocked(getAdminUser).mockResolvedValue(adminUser({ status: "deleted", roles: [] }));
    renderAt();

    const header = (await screen.findByRole("heading", { level: 1 })).parentElement as HTMLElement;

    expect(within(header).getByText("Deleted")).toBeTruthy();
    expect(
      screen.getByText("This account was deleted. Deleted accounts cannot be edited."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Display name")).toBeNull();
  });

  it("shows the not found page for an unknown user", async () => {
    vi.mocked(getAdminUser).mockRejectedValue(new ApiError(404, "Not found.", "not_found"));
    renderAt("5");

    expect(await screen.findByText("Page not found.")).toBeTruthy();
  });

  it("shows the not found page for an id that is not a plain number", () => {
    for (const id of ["1e1", "0x9", "007", "0", "abc"]) {
      renderAt(id);

      expect(screen.getByText("Page not found.")).toBeTruthy();
      cleanup();
    }

    expect(getAdminUser).not.toHaveBeenCalled();
  });

  it("shows an error when the account cannot be loaded", async () => {
    vi.mocked(getAdminUser).mockRejectedValue(new Error("network"));
    renderAt();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We couldn't load this user. Please try again later.",
    );
  });
});

describe("AdminUserDetailPage account actions", () => {
  function dialog() {
    return screen.getByRole("dialog");
  }

  function typeReason(reason: string) {
    fireEvent.change(within(dialog()).getByLabelText("Reason"), { target: { value: reason } });
  }

  it("suspends an active account with a reason", async () => {
    vi.mocked(suspendAdminUser).mockResolvedValue(adminUser({ status: "suspended" }));
    renderAt();

    fireEvent.click(await screen.findByRole("button", { name: "Suspend account" }));

    expect(screen.getByRole("dialog", { name: "Suspend Anna?" })).toBeTruthy();

    const confirm = within(dialog()).getByRole("button", { name: "Suspend" }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);
    typeReason("   ");
    expect(confirm.disabled).toBe(true);
    typeReason("  Spam in the council inbox  ");
    fireEvent.click(confirm);

    const result = await screen.findByText("The account was suspended.");

    expect(suspendAdminUser).toHaveBeenCalledWith(1, "Spam in the council inbox");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(result);
    expect(screen.getByText("Suspended")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reactivate account" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Suspend account" })).toBeNull();
  });

  it("reactivates a suspended account", async () => {
    vi.mocked(getAdminUser).mockResolvedValue(adminUser({ status: "suspended" }));
    vi.mocked(reactivateAdminUser).mockResolvedValue(adminUser());
    renderAt();

    fireEvent.click(await screen.findByRole("button", { name: "Reactivate account" }));
    typeReason("Appeal accepted");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Reactivate" }));

    expect(await screen.findByText("The account was reactivated.")).toBeTruthy();
    expect(reactivateAdminUser).toHaveBeenCalledWith(1, "Appeal accepted");
    expect(screen.getByRole("button", { name: "Suspend account" })).toBeTruthy();
  });

  it("deletes the account after the confirmation and shows it as deleted", async () => {
    vi.mocked(deleteAdminUser).mockResolvedValue(undefined);
    renderAt();

    fireEvent.click(await screen.findByRole("button", { name: "Delete account" }));

    expect(screen.getByRole("dialog", { name: "Delete Anna?" }).textContent).toContain(
      "This cannot be undone.",
    );

    vi.mocked(getAdminUser).mockResolvedValue(
      adminUser({
        display_name: "Deleted user",
        email: "deleted-1@deleted.invalid",
        status: "deleted",
        roles: [],
      }),
    );
    typeReason("Left 42");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete for good" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Deleted user" })).toBeTruthy();
    expect(deleteAdminUser).toHaveBeenCalledWith(1, "Left 42");
    expect(screen.getByText("The account was deleted.")).toBeTruthy();
    expect(
      screen.getByText("This account was deleted. Deleted accounts cannot be edited."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
    expect(getAdminUser).toHaveBeenCalledTimes(2);
  });

  it("closes the popup without a request on Cancel", async () => {
    renderAt();

    fireEvent.click(await screen.findByRole("button", { name: "Delete account" }));
    typeReason("Left 42");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteAdminUser).not.toHaveBeenCalled();
  });

  it("keeps the popup open while the request runs", async () => {
    vi.mocked(suspendAdminUser).mockReturnValue(new Promise(() => {}));
    renderAt();

    fireEvent.click(await screen.findByRole("button", { name: "Suspend account" }));
    typeReason("Spam");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Suspend" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(within(dialog()).getByRole("button", { name: "Suspending…" })).toBeTruthy();
    expect(
      (within(dialog()).getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows the backend's reason message inside the popup", async () => {
    vi.mocked(suspendAdminUser).mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields.", "validation_error", {
        reason: ["Ensure this field has no more than 500 characters."],
      }),
    );
    renderAt();

    fireEvent.click(await screen.findByRole("button", { name: "Suspend account" }));
    typeReason("Spam");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Suspend" }));

    expect((await within(dialog()).findByRole("alert")).textContent).toBe(
      "Ensure this field has no more than 500 characters.",
    );
  });

  it("shows the account as it is now when its status changed meanwhile", async () => {
    vi.mocked(suspendAdminUser).mockRejectedValue(
      new ApiError(409, "The account is not active.", "invalid_user_status"),
    );
    renderAt();

    fireEvent.click(await screen.findByRole("button", { name: "Suspend account" }));
    vi.mocked(getAdminUser).mockResolvedValue(adminUser({ status: "suspended" }));
    typeReason("Spam");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Suspend" }));

    expect(await screen.findByRole("button", { name: "Reactivate account" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      "The account changed in the meantime, so nothing was done. It is shown as it is now.",
    );
  });

  it("keeps what is typed in the edit form after a suspension", async () => {
    vi.mocked(suspendAdminUser).mockResolvedValue(adminUser({ status: "suspended" }));
    renderAt();

    fireEvent.change(await screen.findByLabelText("Display name"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Suspend account" }));
    typeReason("Spam");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Suspend" }));

    await screen.findByText("The account was suspended.");
    expect(input("Display name").value).toBe("Draft");
  });

  it("offers no actions on the Admin's own account", async () => {
    me.id = 1;
    renderAt();

    expect(await screen.findByText("You cannot suspend or delete your own account.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Suspend account" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
  });
});
