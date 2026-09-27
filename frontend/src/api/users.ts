import { apiRequest } from "./client";
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
