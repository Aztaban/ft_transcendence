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

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
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
