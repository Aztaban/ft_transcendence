import { ensureCsrfToken } from "./auth";
import { apiRequest } from "./client";
import type { EvaluationRequest, EvaluationRequestStatus } from "../types/evaluation";
import type { Paginated } from "../types/pagination";

export type EvaluationRequestScope = "mine" | "open" | "picked" | "all";

export interface ListEvaluationRequestsParams {
  scope?: EvaluationRequestScope;
  status?: EvaluationRequestStatus[];
  history?: boolean;
}

// GET /api/v1/evaluation-requests/ (api-plan §10.4), paginated (§5.7).
export function listEvaluationRequests(
  params: ListEvaluationRequestsParams = {},
): Promise<Paginated<EvaluationRequest>> {
  const query = new URLSearchParams();

  if (params.scope) {
    query.set("scope", params.scope);
  }

  if (params.status?.length) {
    query.set("status", params.status.join(","));
  }

  if (params.history !== undefined) {
    query.set("history", String(params.history));
  }

  const search = query.toString();

  return apiRequest<Paginated<EvaluationRequest>>(
    `/api/v1/evaluation-requests/${search ? `?${search}` : ""}`,
  );
}

export interface CreateEvaluationRequestPayload {
  project_id: number;
  note?: string;
}

// POST /api/v1/evaluation-requests/ (api-plan §10.4). Answers 201 with the new EvaluationRequest
// (§8.7); the page only needs to know it succeeded, so the body is not typed here.
export async function createEvaluationRequest(
  payload: CreateEvaluationRequestPayload,
): Promise<void> {
  const csrfToken = await ensureCsrfToken();

  await apiRequest<unknown>("/api/v1/evaluation-requests/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}
