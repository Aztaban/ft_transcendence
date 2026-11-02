import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleProvider, useRole } from "../../store/RoleContext";
import RoleGuard from "./RoleGuard";

const currentUser = vi.hoisted(() => ({ roles: [] as string[], isLoaded: false }));

vi.mock("../../store/AuthContext", () => ({ useOptionalAuth: () => undefined }));
vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));

afterEach(() => {
  cleanup();
  currentUser.roles = [];
  currentUser.isLoaded = false;
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
