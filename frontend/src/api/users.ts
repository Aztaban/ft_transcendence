import { apiRequest } from "./client";
import type { PublicUser } from "../types/people";
import type { Language, UserProfile } from "../types/user";

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
