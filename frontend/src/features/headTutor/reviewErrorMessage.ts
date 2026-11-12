import { ApiError } from "../../api/client";
import i18n from "../../i18n";

// The text for a failed POST /tutor-eligibility-requests/{id}/review/ (api-plan §10.3), shared by
// the review table and the request page. Pages keep the error and call this at render, so the text
// follows the language switcher. An answer without a code (e.g. nginx's HTML 502) gets the
// generic text, never the English developer message.
export function reviewErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code) {
    if (error.code === "cannot_review_own_request") {
      return i18n.t("review.errorOwn");
    }

    if (error.code === "eligibility_request_already_reviewed") {
      return i18n.t("review.errorReviewed");
    }

    return error.fields?.review_note?.[0] ?? error.fields?.decision?.[0] ?? error.message;
  }

  return i18n.t("review.errorGeneric");
}
