import { apiRequest } from "./client";
import type { PublicUser } from "../types/people";
import type { Language, ManagedRoleName, UserProfile } from "../types/user";

export interface UpdateUserProfilePayload {
  display_name?: string;
  language?: Language;
}

export function getCurrentUser(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/api/v1/users/me/");
}

export function updateCurrentUser(payload: UpdateUserProfilePayload): Promise<void> {
  return apiRequest<void>("/api/v1/users/me/", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// GET /api/v1/users/{id}/ (api-plan §10.2): a user's public profile, never their email or 42 login
// (§8.3). 404 for unknown or deleted users.
export function getPublicUser(id: number): Promise<PublicUser> {
  return apiRequest<PublicUser>(`/api/v1/users/${id}/`);
}

// POST /api/v1/users/{id}/roles/ (api-plan §10.2): gives the user a role and returns their updated
// PublicUser; a role they already hold is a no-op 200. 403 `role_not_assignable` for a role the
// caller may not assign (§5.8).
export function assignRole(userId: number, role: ManagedRoleName): Promise<PublicUser> {
  return apiRequest<PublicUser>(`/api/v1/users/${userId}/roles/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

// DELETE /api/v1/users/{id}/roles/{role_id}/ (api-plan §10.2), Admin only: 204 with no body, also
// when the user did not hold the role. 409 `role_not_revocable` or `cannot_modify_self`.
export function revokeRole(userId: number, roleId: number): Promise<void> {
  return apiRequest<void>(`/api/v1/users/${userId}/roles/${roleId}/`, { method: "DELETE" });
}
