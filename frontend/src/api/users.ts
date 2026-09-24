import type { UserProfile } from "../types/user";

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
