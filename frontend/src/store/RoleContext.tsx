import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useOptionalAuth } from "./AuthContext";
import { useCurrentUser } from "./CurrentUserContext";

export const roles = ["STUDENT", "HITCHHIKER", "COUNCIL"] as const;

export type AppRole = (typeof roles)[number];

// The workspaces the user's real roles open (wire names, api-plan §5.8): every user has the
// student workspace, `tutor` / `head_tutor` open the Hitchhiker one, `sc_member` the Student
// Council one. The backend still checks the real roles on every request.
export function workspacesFor(userRoles: readonly string[]): AppRole[] {
  return roles.filter(
    (role) =>
      role === "STUDENT" ||
      (role === "HITCHHIKER" &&
        (userRoles.includes("tutor") || userRoles.includes("head_tutor"))) ||
      (role === "COUNCIL" && userRoles.includes("sc_member")),
  );
}

// The active workspace is kept for this browser tab, so a reload does not send a Hitchhiker back
// to the student workspace. Storage can be unavailable (private mode, blocked site data), so
// every access is guarded and the switcher works without it.
const ACTIVE_ROLE_KEY = "active-role";

function readStoredRole(): AppRole {
  try {
    const stored = sessionStorage.getItem(ACTIVE_ROLE_KEY);

    return roles.find((role) => role === stored) ?? "STUDENT";
  } catch {
    return "STUDENT";
  }
}

function storeRole(role: AppRole) {
  try {
    if (role === "STUDENT") {
      sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    } else {
      sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
    }
  } catch {
    // Remembering the workspace is a convenience only.
  }
}

interface RoleContextValue {
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
  // The workspaces offered in the role switcher.
  availableRoles: readonly AppRole[];
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

// The active workspace is UI state only. It follows the user's real roles: when a role is
// removed (WebSocket `role.changed`, §9.3) its workspace disappears and the user goes back to
// the student workspace. Without a session (logout, an expired session, or one the server
// ended) the tab goes back there too, so the next user starts as a student.
export function RoleProvider({ children }: RoleProviderProps) {
  const auth = useOptionalAuth();
  const { roles: userRoles, isLoaded } = useCurrentUser();
  const [activeRole, setActiveRole] = useState<AppRole>(readStoredRole);

  // The session check has answered, and nobody is logged in.
  const isLoggedOut = auth !== undefined && !auth.isLoading && !auth.isAuthenticated;

  // Until /users/me/ has answered, nothing is known about the roles, so nothing is hidden.
  const availableRoles = isLoaded ? workspacesFor(userRoles) : roles;
  const isActiveAvailable = availableRoles.includes(activeRole);

  useEffect(() => {
    if (!isActiveAvailable) {
      setActiveRole("STUDENT");
    }
  }, [isActiveAvailable]);

  useEffect(() => {
    if (isLoggedOut) {
      setActiveRole("STUDENT");
    }
  }, [isLoggedOut]);

  useEffect(() => {
    storeRole(activeRole);
  }, [activeRole]);

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole, availableRoles }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);

  if (!context) {
    throw new Error("useRole must be used within RoleProvider");
  }

  return context;
}
