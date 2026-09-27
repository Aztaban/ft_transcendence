import type { AppRole } from "../store/RoleContext";

export const routePermissions = {
  home: ["STUDENT", "HITCHHIKER", "COUNCIL"],
  requests: ["STUDENT", "HITCHHIKER"],
  pending: ["STUDENT", "HITCHHIKER"],
  hitchhikers: ["STUDENT", "COUNCIL"],
  profile: ["STUDENT", "HITCHHIKER"],
  council: ["STUDENT", "HITCHHIKER", "COUNCIL"],
  councilMessages: ["COUNCIL"],
  councilHistory: ["COUNCIL"],
} as const satisfies Record<string, readonly AppRole[]>;

export function hasRolePermission(role: AppRole, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(role);
}
