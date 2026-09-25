import { apiRequest } from "./client";
import type { UserProfile } from "../types/user";

export function getCurrentUser(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/api/v1/users/me/");
}
