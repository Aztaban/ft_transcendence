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

// GET /api/v1/evaluation-requests/{id}/ (api-plan §10.4). 404 when the caller may not see it.
export function getEvaluationRequest(id: number): Promise<EvaluationRequest> {
  return apiRequest<EvaluationRequest>(`/api/v1/evaluation-requests/${id}/`);
}

async function postTransition(
  id: number,
  action: "confirm" | "decline",
): Promise<EvaluationRequest> {
  const csrfToken = await ensureCsrfToken();

  return apiRequest<EvaluationRequest>(`/api/v1/evaluation-requests/${id}/${action}/`, {
    method: "POST",
    headers: { "X-CSRFToken": csrfToken },
  });
}

// POST …/{id}/confirm/ (api-plan §10.4), no body: the student accepts the proposed slot.
export function confirmEvaluationRequest(id: number): Promise<EvaluationRequest> {
  return postTransition(id, "confirm");
}

// POST …/{id}/decline/ (api-plan §10.4), no body: back to `pending`, the pick is cleared.
export function declineEvaluationRequest(id: number): Promise<EvaluationRequest> {
  return postTransition(id, "decline");
}
