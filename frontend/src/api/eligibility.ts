import { apiRequest } from "./client";
import type { EligibilityRequest, EligibilityRequestStatus } from "../types/eligibility";
import type { Paginated } from "../types/pagination";
import type { ProjectRef } from "../types/project";

export interface CreateEligibilityRequestPayload {
  project_ids: number[];
}

// POST /api/v1/tutor-eligibility-requests/ (api-plan §10.3): one request for every chosen
// project. 409 `eligibility_request_pending`, 400 on `project_ids`.
export function createEligibilityRequest(
  payload: CreateEligibilityRequestPayload,
): Promise<EligibilityRequest> {
  return apiRequest<EligibilityRequest>("/api/v1/tutor-eligibility-requests/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// GET /api/v1/tutors/{id}/eligibility/ (api-plan §10.3): projects the user may evaluate,
// sorted by name, not paginated. Empty for non-Hitchhikers.
export function getTutorEligibility(userId: number): Promise<ProjectRef[]> {
  return apiRequest<ProjectRef[]>(`/api/v1/tutors/${userId}/eligibility/`);
}

export interface ListEligibilityRequestsOptions {
  // §10.3: `created_at` (default, oldest first: the review order) or `-created_at`.
  ordering?: "created_at" | "-created_at";
  // 1-based page number (§5.7).
  page?: number;
}

// GET /api/v1/tutor-eligibility-requests/ (api-plan §10.3): a Hitchhiker sees their own requests,
// Head Tutors and Admins see all of them. Paginated (§5.7).
export function listEligibilityRequests(
  status?: EligibilityRequestStatus,
  { ordering, page }: ListEligibilityRequestsOptions = {},
): Promise<Paginated<EligibilityRequest>> {
  const query = new URLSearchParams();

  if (status) {
    query.set("status", status);
  }

  if (ordering) {
    query.set("ordering", ordering);
  }

  if (page && page > 1) {
    query.set("page", String(page));
  }

  const search = query.toString();

  return apiRequest<Paginated<EligibilityRequest>>(
    `/api/v1/tutor-eligibility-requests/${search ? `?${search}` : ""}`,
  );
}

export type EligibilityDecision = "approved" | "declined";

export interface ReviewEligibilityRequestPayload {
  decision: EligibilityDecision;
  review_note?: string;
}

// POST /api/v1/tutor-eligibility-requests/{id}/review/ (api-plan §10.3): Head Tutor or Admin.
// 403 `cannot_review_own_request`, 409 `eligibility_request_already_reviewed`.
export function reviewEligibilityRequest(
  id: number,
  payload: ReviewEligibilityRequestPayload,
): Promise<EligibilityRequest> {
  return apiRequest<EligibilityRequest>(`/api/v1/tutor-eligibility-requests/${id}/review/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
