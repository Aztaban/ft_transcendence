import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleProvider, useRole } from "../../store/RoleContext";
import RoleGuard from "./RoleGuard";

const currentUser = vi.hoisted(() => ({
  roles: [] as string[],
  isLoaded: false,
  loadFailed: false,
}));

vi.mock("../../store/AuthContext", () => ({ useOptionalAuth: () => undefined }));
vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));

afterEach(() => {
  cleanup();
  currentUser.roles = [];
  currentUser.isLoaded = false;
  currentUser.loadFailed = false;
  sessionStorage.clear();
});

function ActiveRole() {
  return <span>active: {useRole().activeRole}</span>;
}

function renderGuard(switchWorkspace: boolean) {
  return render(
    <RoleProvider>
      <RoleGuard
        allowedRoles={["COUNCIL"]}
        fallback={<p>Unauthorized</p>}
        switchWorkspace={switchWorkspace}
      >
        <p>Council page</p>
      </RoleGuard>
      <ActiveRole />
    </RoleProvider>,
  );
}

describe("RoleGuard", () => {
  // #770: a workspace restored from the tab is only trusted once /users/me/ has the role.
  it("shows a page of a restored workspace only once the role is confirmed", () => {
    sessionStorage.setItem("active-role", "COUNCIL");

    const view = renderGuard(false);

    expect(screen.queryByText("Council page")).toBeNull();
    expect(screen.queryByText("Unauthorized")).toBeNull();

    currentUser.roles = ["student", "sc_member"];
    currentUser.isLoaded = true;
    view.rerender(
      <RoleProvider>
        <RoleGuard allowedRoles={["COUNCIL"]} fallback={<p>Unauthorized</p>}>
          <p>Council page</p>
        </RoleGuard>
        <ActiveRole />
      </RoleProvider>,
    );

    expect(screen.getByText("Council page")).toBeTruthy();
  });

  it("shows a Student page at once: every account is a student", () => {
    render(
      <RoleProvider>
        <RoleGuard allowedRoles={["STUDENT", "HITCHHIKER"]}>
          <p>Pending page</p>
        </RoleGuard>
      </RoleProvider>,
    );

    expect(screen.getByText("Pending page")).toBeTruthy();
  });

  // #770, the case from the issue: the tab still has the workspace of a role the user lost.
  it("never shows a page of a workspace the user lost, not even for one render", () => {
    const renders: string[] = [];

    function CouncilPage() {
      renders.push("council");

      return <p>Council page</p>;
    }

    sessionStorage.setItem("active-role", "COUNCIL");
    currentUser.roles = ["student"];
    currentUser.isLoaded = true;
    render(
      <RoleProvider>
        <RoleGuard allowedRoles={["COUNCIL"]} fallback={<p>Unauthorized</p>}>
          <CouncilPage />
        </RoleGuard>
        <ActiveRole />
      </RoleProvider>,
    );

    expect(renders).toEqual([]);
    expect(screen.getByText("active: STUDENT")).toBeTruthy();
  });

  it("shows the page when /users/me/ failed, so the page can report its own error", () => {
    sessionStorage.setItem("active-role", "COUNCIL");
    currentUser.loadFailed = true;

    renderGuard(false);

    expect(screen.getByText("Council page")).toBeTruthy();
  });

  it("shows the fallback in another workspace", () => {
    currentUser.roles = ["student", "sc_member"];
    currentUser.isLoaded = true;

    renderGuard(false);

    expect(screen.getByText("Unauthorized")).toBeTruthy();
  });

  it("switches to an allowed workspace the user has, e.g. from a notification link", async () => {
    currentUser.roles = ["student", "sc_member"];
    currentUser.isLoaded = true;

    renderGuard(true);

    expect(await screen.findByText("Council page")).toBeTruthy();
    expect(screen.getByText("active: COUNCIL")).toBeTruthy();
  });

  it("still refuses a user without that role", () => {
    currentUser.roles = ["student"];
    currentUser.isLoaded = true;

    renderGuard(true);

    expect(screen.getByText("Unauthorized")).toBeTruthy();
    expect(screen.getByText("active: STUDENT")).toBeTruthy();
  });

  it("waits for the user's roles before deciding", () => {
    renderGuard(true);

    expect(screen.queryByText("Unauthorized")).toBeNull();
    expect(screen.queryByText("Council page")).toBeNull();
  });
});
