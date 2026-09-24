import type { Language, UserProfile } from "../types/user";

export interface UpdateUserProfilePayload {
  display_name: string;
  language: Language;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch("/api/v1/users/me/", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load profile (${response.status})`);
  }

  return response.json() as Promise<UserProfile>;
}

export async function updateCurrentUser(payload: UpdateUserProfilePayload): Promise<void> {
  const response = await fetch("/api/v1/users/me/", {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Unable to update profile (${response.status})`);
  }
}
