import { ApiError } from "../../api/client";
import i18n from "../../i18n";
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
      return i18n.t("cancelRequest.errorStarted");
    }

    if (error.code === "invalid_state_transition") {
      return i18n.t("cancelRequest.errorInvalidState");
    }

    if (error.status === 404) {
      return i18n.t("cancelRequest.errorGone");
    }

    return error.message;
  }

  return i18n.t("cancelRequest.errorGeneric");
}
