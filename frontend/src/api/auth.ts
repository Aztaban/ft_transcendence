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
