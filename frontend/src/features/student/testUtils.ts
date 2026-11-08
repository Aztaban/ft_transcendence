import type { EvaluationRequest, EvaluationRequestStatus } from "../../types/evaluation";

// Builds an EvaluationRequest (api-plan §8.7) as the student receives it: the slot times are set
// for picked requests, and picked_by only once the student has confirmed (R18).
export function makeRequest(
  id: number,
  projectName: string,
  status: EvaluationRequestStatus,
): EvaluationRequest {
  const isPicked = status === "awaiting_confirmation" || status === "confirmed";

  return {
    id,
    student: { id: 1, display_name: "Student", avatar_url: null },
    project: { id, slug: projectName, name: projectName },
    note: "",
    status,
    picked_by:
      status === "confirmed" ? { id: 2, display_name: "Hitchhiker", avatar_url: null } : null,
    starts_at: isPicked ? "2026-10-12T15:00:00Z" : null,
    ends_at: isPicked ? "2026-10-12T15:45:00Z" : null,
    cancelled_by: null,
    cancelled_at: status === "cancelled" ? "2026-10-11T10:00:00Z" : null,
    expired_at: status === "expired" ? "2026-10-11T10:00:00Z" : null,
    result: null,
    feedback: "",
    completed_at: null,
    is_history: status === "cancelled" || status === "expired",
    created_at: "2026-10-10T09:00:00Z",
    updated_at: "2026-10-10T09:00:00Z",
  };
}
