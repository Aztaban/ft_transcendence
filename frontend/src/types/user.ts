export type Language = "en" | "cs" | "es";

// Wire role names (api-plan §5.8).
export type RoleName = "student" | "tutor" | "head_tutor" | "sc_member" | "admin";

// api-plan §8.5.
export interface UserRole {
  id: number;
  name: RoleName;
}

// The caller's own profile from GET /users/me/ (api-plan §8.2), the only representation with
// private fields.
export interface UserProfile {
  id: number;
  email: string;
  display_name: string;
  // Relative URL of the avatar download; null means the default avatar.
  avatar_url: string | null;
  language: Language;
  // Sorted by name; every account has at least `student`.
  roles: UserRole[];
  // The 42 login when the account came from 42 OAuth.
  intra_login: string | null;
}
