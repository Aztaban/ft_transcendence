import type { UserProfile } from "./user";

// api-plan §8.4.
export type UserStatus = "active" | "suspended" | "deleted";

// Returned by the admin user endpoints only (api-plan §8.4): `Me` (§8.2) plus the account's
// status and dates.
export interface AdminUser extends UserProfile {
  status: UserStatus;
  // UTC ISO 8601 datetimes, shown in the user's local time.
  created_at: string;
  // Null until the user logs in for the first time.
  last_login: string | null;
}
