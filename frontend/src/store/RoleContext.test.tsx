import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleProvider, useRole, workspacesFor } from "./RoleContext";

const currentUser = vi.hoisted(() => ({ roles: [] as string[], isLoaded: false }));
// The session check; `undefined` stands for "no AuthProvider".
const session = vi.hoisted(() => ({
  value: { isLoading: false, isAuthenticated: true } as
    { isLoading: boolean; isAuthenticated: boolean } | undefined,
}));

vi.mock("./AuthContext", () => ({ useOptionalAuth: () => session.value }));

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

function renderProvider() {
  return render(
    <RoleProvider>
      <Probe />
    </RoleProvider>,
  );
}

afterEach(() => {
  cleanup();
  currentUser.roles = [];
  currentUser.isLoaded = false;
  sessionStorage.clear();
  vi.restoreAllMocks();
  session.value = { isLoading: false, isAuthenticated: true };
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
    expect(sessionStorage.getItem("active-role")).toBeNull();
  });
});

describe("RoleProvider after a reload", () => {
  it("saves the workspace the user switches to for this tab", () => {
    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;
    renderProvider();

    expect(sessionStorage.getItem("active-role")).toBeNull();

    act(() => screen.getByRole("button", { name: "switch" }).click());

    expect(sessionStorage.getItem("active-role")).toBe("HITCHHIKER");
  });

  it("restores the saved workspace, also while the roles are loading", () => {
    sessionStorage.setItem("active-role", "HITCHHIKER");

    const view = renderProvider();

    expect(screen.getByText("active: HITCHHIKER")).toBeTruthy();

    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;
    view.rerender(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    expect(screen.getByText("active: HITCHHIKER")).toBeTruthy();
    expect(sessionStorage.getItem("active-role")).toBe("HITCHHIKER");
  });

  it("goes back to the student workspace when the saved one is not the user's", () => {
    sessionStorage.setItem("active-role", "COUNCIL");
    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;
    renderProvider();

    expect(screen.getByText("active: STUDENT")).toBeTruthy();
    expect(sessionStorage.getItem("active-role")).toBeNull();
  });

  it("ignores a saved value that is not a workspace", () => {
    sessionStorage.setItem("active-role", "ADMIN");
    renderProvider();

    expect(screen.getByText("active: STUDENT")).toBeTruthy();
  });

  it("forgets the workspace on logout", () => {
    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;

    const view = renderProvider();

    act(() => screen.getByRole("button", { name: "switch" }).click());
    expect(sessionStorage.getItem("active-role")).toBe("HITCHHIKER");

    // Logout: the session check says nobody is logged in, and the profile is dropped.
    session.value = { isLoading: false, isAuthenticated: false };
    currentUser.roles = [];
    currentUser.isLoaded = false;
    view.rerender(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    expect(screen.getByText("active: STUDENT")).toBeTruthy();
    expect(sessionStorage.getItem("active-role")).toBeNull();
  });

  it("starts as a student after a reload with an expired session", () => {
    sessionStorage.setItem("active-role", "HITCHHIKER");
    session.value = { isLoading: true, isAuthenticated: false };

    const view = renderProvider();

    // While the session check runs, the saved workspace is kept.
    expect(screen.getByText("active: HITCHHIKER")).toBeTruthy();

    // /users/me/ is never loaded: the session check alone says nobody is logged in.
    session.value = { isLoading: false, isAuthenticated: false };
    view.rerender(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    expect(screen.getByText("active: STUDENT")).toBeTruthy();
    expect(sessionStorage.getItem("active-role")).toBeNull();
  });

  it("keeps the saved workspace without an AuthProvider", () => {
    sessionStorage.setItem("active-role", "HITCHHIKER");
    session.value = undefined;
    renderProvider();

    expect(screen.getByText("active: HITCHHIKER")).toBeTruthy();
  });

  it("still switches when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;
    renderProvider();

    expect(screen.getByText("active: STUDENT")).toBeTruthy();

    act(() => screen.getByRole("button", { name: "switch" }).click());

    expect(screen.getByText("active: HITCHHIKER")).toBeTruthy();
  });
});
