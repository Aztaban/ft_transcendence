import { ApiError } from "../../api/client";
import type { EvaluationRequest } from "../../types/evaluation";

const CANCELLABLE = ["pending", "awaiting_confirmation", "confirmed"];

// A student can cancel their request while it is pending, awaiting confirmation or confirmed,
// until its slot starts (api-plan §7.1, §10.4); after that the API answers 409
// `evaluation_already_started`.
export function canCancel(request: EvaluationRequest, now = new Date()) {
  return (
    CANCELLABLE.includes(request.status) &&
    (request.starts_at === null || new Date(request.starts_at).getTime() > now.getTime())
  );
}

export function cancelErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "evaluation_already_started") {
      return "This evaluation has already started, so it can't be cancelled.";
    }

    if (error.code === "invalid_state_transition") {
      return "This request can no longer be cancelled.";
    }

    if (error.status === 404) {
      return "This request no longer exists.";
    }

    return error.message;
  }

  return "Could not cancel the request. Please try again.";
}
