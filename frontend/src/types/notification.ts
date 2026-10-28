// Shapes from docs/api-plan.md §8.8 and §10.5.

// GET /notifications/unread-count/: the number on the bell badge.
export interface UnreadCount {
  count: number;
}

// The notification types of §8.8. The frontend builds the sentence from `type` and `payload`.
export type NotificationType =
  | "evaluation.created"
  | "evaluation.slot_picked"
  | "evaluation.confirmed"
  | "evaluation.declined"
  | "evaluation.released"
  | "evaluation.cancelled"
  | "evaluation.expired"
  | "evaluation.result_recorded"
  | "eligibility.requested"
  | "eligibility.decided"
  | "eligibility.revoked"
  | "role.changed"
  | "account.updated"
  | "sc_message.created"
  | "resource.created"
  | "resource.updated"
  | "resource.deleted";

export interface Notification {
  id: number;
  type: NotificationType;
  // Shape depends on `type` (§8.8); read with care.
  payload: Record<string, unknown>;
  // Frontend route to open; empty when the notification has no target.
  target_url: string;
  // `null` = unread.
  read_at: string | null;
  created_at: string;
}
