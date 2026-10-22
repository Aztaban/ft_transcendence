import type { AppRole } from "../store/RoleContext";

export const routePermissions = {
  home: ["STUDENT", "HITCHHIKER", "COUNCIL"],
  requests: ["STUDENT", "HITCHHIKER"],
  eligibilityRequest: ["HITCHHIKER"],
  // The page also checks the real head_tutor / admin role.
  eligibilityReview: ["HITCHHIKER"],
  pending: ["STUDENT", "HITCHHIKER"],
  history: ["STUDENT", "HITCHHIKER"],
  hitchhikers: ["STUDENT", "COUNCIL"],
  profile: ["STUDENT", "HITCHHIKER"],
  council: ["STUDENT", "HITCHHIKER", "COUNCIL"],
  councilMessages: ["COUNCIL"],
  councilHistory: ["COUNCIL"],
} as const satisfies Record<string, readonly AppRole[]>;

export function hasRolePermission(role: AppRole, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(role);
}

// Head Tutors and Admins review eligibility requests (api-plan §10.3). Takes the user's real
// roles (wire names, §5.8), not the active workspace.
export function canReviewEligibility(userRoles: readonly string[]): boolean {
  return userRoles.includes("head_tutor") || userRoles.includes("admin");
}
