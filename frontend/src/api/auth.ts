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

export interface SessionResponse {
  authenticated: true;
  user: AuthUser;
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`;

  for (const cookie of document.cookie.split(";")) {
    const trimmed = cookie.trim();

    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return null;
}

async function ensureCsrfToken(): Promise<string> {
  await apiRequest<{ status: string; version: string }>("/api/v1/");

  const csrfToken = getCookie("csrftoken");

  if (!csrfToken) {
    throw new Error("CSRF token is unavailable.");
  }

  return csrfToken;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const csrfToken = await ensureCsrfToken();

  return apiRequest<LoginResponse>("/api/v1/auth/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export function getSession(): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/api/v1/auth/session/");
}

export async function logoutUser(): Promise<void> {
  const csrfToken = await ensureCsrfToken();

  await apiRequest<void>("/api/v1/auth/logout/", {
    method: "POST",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });
}
