// Shape from docs/api-plan.md §8.7. UserRef (§8.1) and ProjectRef (§8.6) live in ./project.
import type { ProjectRef, UserRef } from "./project";

export type { ProjectRef, UserRef };

export type EvaluationRequestStatus =
  "pending" | "awaiting_confirmation" | "confirmed" | "cancelled" | "expired";

export type EvaluationResult = "passed" | "failed";

export interface EvaluationRequest {
  id: number;
  // null for anyone except the student, the Hitchhiker in `picked_by`, Head Tutors and Admins:
  // a `pending` request is anonymous to eligible Hitchhikers (R15).
  student: UserRef | null;
  project: ProjectRef;
  note: string;
  status: EvaluationRequestStatus;
  // null for the student while `awaiting_confirmation` and on `cancelled` requests (R18, §8.7).
  picked_by: UserRef | null;
  starts_at: string | null;
  ends_at: string | null;
  cancelled_by: UserRef | null;
  cancelled_at: string | null;
  expired_at: string | null;
  result: EvaluationResult | null;
  feedback: string;
  completed_at: string | null;
  is_history: boolean;
  created_at: string;
  updated_at: string;
}

// Why a request needs a human decision (api-plan §10.9). When several apply, the backend picks
// the first in this order: participant_inactive, tutor_lost_eligibility, result_missing.
export type EvaluationProblem =
  "participant_inactive" | "tutor_lost_eligibility" | "result_missing";

// One row of GET /admin/evaluation-requests/exceptions/: an EvaluationRequest (§8.7) with the
// extra `problem` field (§10.9).
export interface EvaluationException extends EvaluationRequest {
  problem: EvaluationProblem;
}
