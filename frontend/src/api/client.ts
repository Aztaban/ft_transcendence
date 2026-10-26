import i18n from "../i18n";

export interface ApiErrorFields {
  [field: string]: string[];
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    fields?: ApiErrorFields;
  };
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: ApiErrorFields;

  constructor(status: number, message: string, code?: string, fields?: ApiErrorFields) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Methods that change data need the CSRF header (api-plan §5.4).
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

// Reads the csrftoken cookie on every request (Django issues a new one at login, §5.4).
// If it is missing, GET /api/v1/ sets it first. That call is a GET, so it does not recurse.
async function getCsrfToken(): Promise<string> {
  let csrfToken = getCookie("csrftoken");

  if (!csrfToken) {
    await apiRequest<{ status: string; version: string }>("/api/v1/");
    csrfToken = getCookie("csrftoken");
  }

  if (!csrfToken) {
    throw new Error("CSRF token is unavailable.");
  }

  return csrfToken;
}

// Called when an API answers 401 `not_authenticated`: the session ended on the server (it
// expired, or the user logged out in another tab). The auth endpoints are left out: they answer
// for the login form itself.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  // The backend answers its messages in this language (api-plan §5.5).
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", i18n.language || "en");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (UNSAFE_METHODS.has((options.method ?? "GET").toUpperCase())) {
    headers.set("X-CSRFToken", await getCsrfToken());
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  let body: ApiErrorPayload | T | undefined;

  if (response.status !== 204) {
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      body = (await response.json()) as ApiErrorPayload | T;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/v1/auth/")) {
      onUnauthorized?.();
    }

    const errorBody = body as ApiErrorPayload | undefined;
    const backendError = errorBody?.error;

    throw new ApiError(
      response.status,
      backendError?.message ?? `API request failed: ${response.status} ${response.statusText}`,
      backendError?.code,
      backendError?.fields,
    );
  }

  return body as T;
}
