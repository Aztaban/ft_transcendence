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

export interface PickSlotPayload {
  starts_at: string;
  ends_at: string;
}

// POST /api/v1/evaluation-requests/{id}/pick-slot/ (api-plan §10.4); slot rules in §7.1.
// apiRequest adds the CSRF header (§5.4).
export function pickSlot(id: number, payload: PickSlotPayload): Promise<EvaluationRequest> {
  return apiRequest<EvaluationRequest>(`/api/v1/evaluation-requests/${id}/pick-slot/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
