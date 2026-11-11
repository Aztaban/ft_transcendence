// Shapes from docs/api-plan.md §10.9 (audit log).
import type { UserRef } from "./project";

export type AuditAction =
  | "role.assigned"
  | "role.revoked"
  | "user.updated"
  | "user.suspended"
  | "user.reactivated"
  | "user.deleted"
  | "eligibility.reviewed"
  | "eligibility.revoked"
  | "evaluation.released_by_override"
  | "evaluation.cancelled_by_override"
  | "sc_message.sender_revealed"
  | "sc_message.deleted";

export type AuditTargetType =
  "user" | "evaluation_request" | "tutor_eligibility_request" | "tutor_eligibility" | "sc_message";

// One audit entry. `actor` is null when the account that acted was deleted. `metadata` depends
// on the action: `{ role }` for roles, `{ decision }` for an eligibility review, `{ old, new }`
// for a user edit, `{}` otherwise.
export interface AuditEntry {
  id: number;
  actor: UserRef | null;
  action: AuditAction;
  target_type: AuditTargetType;
  target_id: number;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
