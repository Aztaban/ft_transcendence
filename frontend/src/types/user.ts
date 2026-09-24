export type Language = "en" | "cs" | "cz" | "es";

export interface UserRole {
  id?: number;
  name: string;
}

export interface UserProfile {
  id: number;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  language: Language;
  roles: Array<UserRole | string>;
}
