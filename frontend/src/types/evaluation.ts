// Shapes from docs/api-plan.md §8.1, §8.6 and §8.7.

export interface UserRef {
  id: number;
  display_name: string;
  avatar_url: string | null;
}

export interface ProjectRef {
  id: number;
  slug: string;
  name: string;
}

export type EvaluationRequestStatus =
  "pending" | "awaiting_confirmation" | "confirmed" | "cancelled" | "expired";

export type EvaluationResult = "passed" | "failed";

export interface EvaluationRequest {
  id: number;
  student: UserRef;
  project: ProjectRef;
  note: string;
  status: EvaluationRequestStatus;
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
