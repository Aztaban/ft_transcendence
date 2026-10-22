// Shape from docs/api-plan.md §8.9.
import type { ProjectRef, UserRef } from "./project";

export type EligibilityRequestStatus = "pending" | "approved" | "declined";

export interface EligibilityRequest {
  id: number;
  requester: UserRef;
  projects: ProjectRef[];
  status: EligibilityRequestStatus;
  reviewed_by: UserRef | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
}
