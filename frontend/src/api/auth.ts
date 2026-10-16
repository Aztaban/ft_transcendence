import { apiRequest } from "./client";

export interface RegistrationPayload {
  email: string;
  display_name: string;
  password: string;
}

export interface RegistrationResponse {
  id: number;
  email: string;
  display_name: string;
  message: string;
}

export function registerUser(payload: RegistrationPayload): Promise<RegistrationResponse> {
  return apiRequest<RegistrationResponse>("/api/v1/auth/register/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthUser {
  message: string;
}

export type SessionResponse =
  { authenticated: true; user: AuthUser } | { authenticated: false; user: null };

export function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function getSession(): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/api/v1/auth/session/");
}

export async function logoutUser(): Promise<void> {
  await apiRequest<void>("/api/v1/auth/logout/", {
    method: "POST",
  });
}
