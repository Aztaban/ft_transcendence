import type { ManagedRoleName, UserRole } from "../../types/user";

// The roles someone holding `myRoles` may give to another user (api-plan §5.8), in the order they
// are offered. One check per role, so a user with several roles (Admin and Head Tutor) gets each
// role once.
export function assignableRoles(myRoles: UserRole[]): ManagedRoleName[] {
  const names = myRoles.map((role) => role.name);
  const isAdmin = names.includes("admin");
  const roles: ManagedRoleName[] = [];

  if (isAdmin || names.includes("head_tutor")) {
    roles.push("tutor");
  }

  if (isAdmin) {
    roles.push("head_tutor");
  }

  if (isAdmin || names.includes("sc_member")) {
    roles.push("sc_member");
  }

  return roles;
}

// Only an Admin removes roles (api-plan §5.8).
export function canRevokeRoles(myRoles: UserRole[]): boolean {
  return myRoles.some((role) => role.name === "admin");
}
