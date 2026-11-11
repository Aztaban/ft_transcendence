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
  // The backend also checks the real admin role (api-plan §10.2).
  adminUsers: ["ADMIN"],
  // Head Tutors open it in the Hitchhiker workspace, Admins in the Admin one; the page also checks
  // the real head_tutor / admin role.
  evaluationExceptions: ["HITCHHIKER", "ADMIN"],
  // The page and the backend also check the real admin role (api-plan §10.9).
  auditLog: ["ADMIN"],
} as const satisfies Record<string, readonly AppRole[]>;

export function hasRolePermission(role: AppRole, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(role);
}

// Only Admins read the audit log (api-plan §10.9). Takes the user's real roles (wire names).
export function canViewAuditLog(userRoles: readonly string[]): boolean {
  return userRoles.includes("admin");
}

// Head Tutors and Admins review eligibility requests (api-plan §10.3). Takes the user's real
// roles (wire names, §5.8), not the active workspace.
export function canReviewEligibility(userRoles: readonly string[]): boolean {
  return userRoles.includes("head_tutor") || userRoles.includes("admin");
}

// SC Members and Admins read council messages (api-plan §10.6), so both get the Student Council
// workspace. Takes the user's real roles (wire names, §5.8).
export function canReadCouncilMessages(userRoles: readonly string[]): boolean {
  return userRoles.includes("sc_member") || userRoles.includes("admin");
}

// Only Admins delete a council message or reveal its sender (api-plan §10.6).
export function canModerateCouncil(userRoles: readonly string[]): boolean {
  return userRoles.includes("admin");
}

// Head Tutors and Admins see the evaluation requests that need a human decision (api-plan §10.9).
// Takes the user's real roles (wire names, §5.8).
export function canSeeEvaluationExceptions(userRoles: readonly string[]): boolean {
  return userRoles.includes("head_tutor") || userRoles.includes("admin");
}

// Head Tutors and Admins may release or cancel someone else's evaluation request with a reason
// (an override, api-plan §5.8). Takes the user's real roles (wire names, §5.8).
export function canOverrideEvaluations(userRoles: readonly string[]): boolean {
  return userRoles.includes("head_tutor") || userRoles.includes("admin");
}
