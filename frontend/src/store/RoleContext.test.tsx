import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleProvider, useRole, workspacesFor } from "./RoleContext";

const currentUser = vi.hoisted(() => ({ roles: [] as string[], isLoaded: false }));

vi.mock("./CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));

function Probe() {
  const { activeRole, availableRoles, setActiveRole } = useRole();

  return (
    <>
      <p>active: {activeRole}</p>
      <p>available: {availableRoles.join(",")}</p>
      <button type="button" onClick={() => setActiveRole("HITCHHIKER")}>
        switch
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  currentUser.roles = [];
  currentUser.isLoaded = false;
});

describe("workspacesFor", () => {
  it("opens a workspace per real role", () => {
    expect(workspacesFor(["student"])).toEqual(["STUDENT"]);
    expect(workspacesFor(["student", "tutor"])).toEqual(["STUDENT", "HITCHHIKER"]);
    expect(workspacesFor(["head_tutor"])).toEqual(["STUDENT", "HITCHHIKER"]);
    expect(workspacesFor(["student", "sc_member"])).toEqual(["STUDENT", "COUNCIL"]);
    expect(workspacesFor(["tutor", "sc_member"])).toEqual(["STUDENT", "HITCHHIKER", "COUNCIL"]);
  });
});

describe("RoleProvider", () => {
  it("offers every workspace until the roles are known", () => {
    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    expect(screen.getByText("available: STUDENT,HITCHHIKER,COUNCIL")).toBeTruthy();
  });

  it("offers only the workspaces of the user's roles", () => {
    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;

    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    expect(screen.getByText("available: STUDENT,HITCHHIKER")).toBeTruthy();
  });

  it("goes back to the student workspace when the active role is removed", () => {
    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;

    const view = render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    act(() => screen.getByRole("button", { name: "switch" }).click());
    expect(screen.getByText("active: HITCHHIKER")).toBeTruthy();

    // role.changed: the tutor role was revoked.
    currentUser.roles = ["student"];
    view.rerender(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    expect(screen.getByText("active: STUDENT")).toBeTruthy();
    expect(screen.getByText("available: STUDENT")).toBeTruthy();
  });
});
