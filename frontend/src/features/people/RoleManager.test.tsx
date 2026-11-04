import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { assignRole, revokeRole } from "../../api/users";
import i18n from "../../i18n";
import type { PublicUser } from "../../types/people";
import type { RoleName, UserRole } from "../../types/user";
import RoleManager from "./RoleManager";

vi.mock("../../api/users", () => ({ assignRole: vi.fn(), revokeRole: vi.fn() }));

// The ids of the seeded roles, as in GET /users/me/ and PublicUser (§8.5).
const roleIds: Record<RoleName, number> = {
  student: 1,
  tutor: 2,
  head_tutor: 3,
  sc_member: 4,
  admin: 5,
};

function roles(...names: RoleName[]): UserRole[] {
  return names.map((name) => ({ id: roleIds[name], name }));
}

function person(...names: RoleName[]): PublicUser {
  return { id: 7, display_name: "Alice", avatar_url: null, roles: roles("student", ...names) };
}

afterEach(async () => {
  cleanup();
  vi.resetAllMocks();
  await i18n.changeLanguage("en");
});

function renderManager(target: PublicUser, myRoles: UserRole[], onChange = vi.fn()) {
  render(<RoleManager person={target} myRoles={myRoles} onChange={onChange} />);

  return onChange;
}

function options() {
  return within(screen.getByRole("combobox", { name: "Role to add" }))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

describe("RoleManager", () => {
  it("offers an Admin the roles the person lacks and lets them remove the others", () => {
    renderManager(person("sc_member"), roles("student", "admin"));

    expect(screen.getByRole("heading", { name: "Manage roles" })).toBeTruthy();
    expect(options()).toEqual(["Hitchhiker", "Head Tutor"]);
    expect(
      within(screen.getByRole("list", { name: "Roles you can remove" }))
        .getAllByRole("listitem")
        .map((item) => item.firstChild?.textContent),
    ).toEqual(["Student Council"]);
    expect(screen.getByRole("button", { name: "Remove the role Student Council" })).toBeTruthy();
  });

  it("offers a Head Tutor only Hitchhiker and no Remove buttons", () => {
    renderManager(person(), roles("student", "head_tutor"));

    expect(options()).toEqual(["Hitchhiker"]);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("says so when the person already has every role the user can give", () => {
    renderManager(person("tutor"), roles("student", "head_tutor"));

    expect(screen.getByText("They already have every role you can give.")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows nothing to users who may not change roles", () => {
    renderManager(person(), roles("student", "tutor"));

    expect(screen.queryByRole("heading", { name: "Manage roles" })).toBeNull();
  });

  it("adds the picked role and passes the updated person on", async () => {
    const updated = person("head_tutor");

    vi.mocked(assignRole).mockResolvedValue(updated);
    const onChange = renderManager(person(), roles("student", "admin"));

    fireEvent.change(screen.getByRole("combobox", { name: "Role to add" }), {
      target: { value: "head_tutor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));

    expect(await screen.findByText("Role Head Tutor added.")).toBeTruthy();
    expect(assignRole).toHaveBeenCalledWith(7, "head_tutor");
    expect(onChange).toHaveBeenCalledWith(updated);
  });

  it("removes a role by its id and drops it from the person", async () => {
    vi.mocked(revokeRole).mockResolvedValue(undefined);
    const onChange = renderManager(person("tutor", "sc_member"), roles("student", "admin"));

    fireEvent.click(screen.getByRole("button", { name: "Remove the role Hitchhiker" }));

    expect(await screen.findByText("Role Hitchhiker removed.")).toBeTruthy();
    expect(revokeRole).toHaveBeenCalledWith(7, 2);
    expect(onChange).toHaveBeenCalledWith({
      id: 7,
      display_name: "Alice",
      avatar_url: null,
      roles: [
        { id: 1, name: "student" },
        { id: 4, name: "sc_member" },
      ],
    });
  });

  it("disables the buttons while a change is being saved", async () => {
    let answer: (value: PublicUser) => void = () => {};

    vi.mocked(assignRole).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderManager(person("sc_member"), roles("student", "admin"));

    fireEvent.click(screen.getByRole("button", { name: "Add role" }));

    expect(screen.getByRole("button", { name: "Saving…" }).hasAttribute("disabled")).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Remove the role Student Council" })
        .hasAttribute("disabled"),
    ).toBe(true);

    await act(async () => answer(person("tutor", "sc_member")));

    expect(screen.getByRole("button", { name: "Add role" }).hasAttribute("disabled")).toBe(false);
  });

  it.each([
    [403, "role_not_assignable", "You may not give this role."],
    [403, "permission_denied", "You are not allowed to change roles."],
    [404, "not_found", "This account no longer exists."],
    [400, "validation_error", "Could not change the role. Please try again."],
  ])("shows the message for a %i %s when adding", async (status, code, message) => {
    vi.mocked(assignRole).mockRejectedValue(new ApiError(status, "Backend text", code));
    const onChange = renderManager(person(), roles("student", "head_tutor"));

    fireEvent.click(screen.getByRole("button", { name: "Add role" }));

    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ["role_not_revocable", "This role cannot be removed."],
    ["cannot_modify_self", "You cannot change your own roles."],
  ])("shows the message for a 409 %s when removing", async (code, message) => {
    vi.mocked(revokeRole).mockRejectedValue(new ApiError(409, "Backend text", code));
    const onChange = renderManager(person("tutor"), roles("student", "admin"));

    fireEvent.click(screen.getByRole("button", { name: "Remove the role Hitchhiker" }));

    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a general message when the network fails", async () => {
    vi.mocked(revokeRole).mockRejectedValue(new TypeError("Failed to fetch"));
    renderManager(person("tutor"), roles("student", "admin"));

    fireEvent.click(screen.getByRole("button", { name: "Remove the role Hitchhiker" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not change the role. Please try again.",
    );
  });

  it("is translated into Czech", async () => {
    await i18n.changeLanguage("cs");
    renderManager(person(), roles("student", "sc_member"));

    expect(screen.getByRole("heading", { name: "Správa rolí" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Přidat roli" })).toBeTruthy();
    expect(
      within(screen.getByRole("combobox", { name: "Role k přidání" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Studentská rada"]);
  });
});
