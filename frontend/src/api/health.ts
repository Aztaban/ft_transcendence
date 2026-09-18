import { apiRequest } from "./client";

export interface HealthResponse {
  status: string;
  db: string;
  redis: string;
  celery: string;
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health/");
}
