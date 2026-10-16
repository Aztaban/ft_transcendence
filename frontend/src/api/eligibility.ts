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

// GET /api/v1/tutor-eligibility-requests/ (api-plan §10.3): a Hitchhiker sees their own requests.
export function listEligibilityRequests(
  status?: EligibilityRequestStatus,
): Promise<Paginated<EligibilityRequest>> {
  return apiRequest<Paginated<EligibilityRequest>>(
    `/api/v1/tutor-eligibility-requests/${status ? `?status=${status}` : ""}`,
  );
}
