export type Language = "en" | "cs" | "es";

export interface UserRole {
  id?: number;
  name: string;
}

export interface UserProfile {
  id: number;
  email: string;
  display_name: string;
  language: Language;
  roles: Array<UserRole | string>;
}
