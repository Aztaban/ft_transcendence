// WebSocket events from docs/api-plan.md §9.3. Events carry ids, never full objects: on receipt
// the frontend re-fetches what it shows over REST (§9.2).
import type { EvaluationRequestStatus } from "../types/evaluation";

interface EvaluationEventData {
  id: number;
  status: EvaluationRequestStatus;
}

export interface LiveEventData {
  "evaluation.created": EvaluationEventData;
  "evaluation.updated": EvaluationEventData;
  "evaluation.slot_picked": EvaluationEventData;
  "evaluation.confirmed": EvaluationEventData;
  "evaluation.declined": EvaluationEventData;
  "evaluation.released": EvaluationEventData;
  "evaluation.cancelled": EvaluationEventData;
  "evaluation.expired": EvaluationEventData;
  "eligibility.requested": { id: number };
  // EligibilityRequest status after a review (§8.9).
  "eligibility.decided": { id: number; status: "approved" | "declined" };
  "eligibility.revoked": { project_id: number };
  "role.changed": Record<string, never>;
  "notification.created": { id: number };
  "notification.updated": Record<string, never>;
  "session.ended": Record<string, never>;
}

export type LiveEventName = keyof LiveEventData;

export type LiveMessage = {
  [Name in LiveEventName]: { event: Name; data: LiveEventData[Name] };
}[LiveEventName];

export const LIVE_EVENT_NAMES: readonly LiveEventName[] = [
  "evaluation.created",
  "evaluation.updated",
  "evaluation.slot_picked",
  "evaluation.confirmed",
  "evaluation.declined",
  "evaluation.released",
  "evaluation.cancelled",
  "evaluation.expired",
  "eligibility.requested",
  "eligibility.decided",
  "eligibility.revoked",
  "role.changed",
  "notification.created",
  "notification.updated",
  "session.ended",
];

// Every `evaluation.*` event, for pages that show evaluation requests.
export const EVALUATION_EVENTS = LIVE_EVENT_NAMES.filter((name) => name.startsWith("evaluation."));

// The Hitchhiker's open queue (`scope=open`): requests appear, leave and come back with the
// evaluation events, and the queue depends on the Hitchhiker's eligibility (§9.3).
export const OPEN_QUEUE_EVENTS: readonly LiveEventName[] = [
  ...EVALUATION_EVENTS,
  "eligibility.decided",
  "eligibility.revoked",
];

// Parses a server message (§9.2). Anything that is not a known event is ignored.
export function parseLiveMessage(raw: unknown): LiveMessage | null {
  if (typeof raw !== "string") {
    return null;
  }

  try {
    const message = JSON.parse(raw) as { event?: unknown; data?: unknown };

    if (
      typeof message !== "object" ||
      message === null ||
      typeof message.event !== "string" ||
      !LIVE_EVENT_NAMES.includes(message.event as LiveEventName) ||
      typeof message.data !== "object" ||
      message.data === null
    ) {
      return null;
    }

    return message as LiveMessage;
  } catch {
    return null;
  }
}
