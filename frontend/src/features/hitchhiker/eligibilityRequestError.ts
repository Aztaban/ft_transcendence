import { ApiError } from "../../api/client";
import i18n from "../../i18n";

// The text for a failed POST /tutor-eligibility-requests/ (api-plan §10.3), shared by the
// welcome popup and the request page. Pages keep the error and call this at render, so the text
// follows the language switcher. An answer without a code (e.g. nginx's HTML 502 while the
// backend restarts) gets the generic text, never the English developer message.
export function eligibilityRequestErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code) {
    if (error.code === "eligibility_request_pending") {
      return i18n.t("welcome.errorPending");
    }

    if (error.code === "permission_denied") {
      return i18n.t("welcome.errorPermission");
    }

    return error.fields?.project_ids?.[0] ?? error.message;
  }

  return i18n.t("createRequest.errorGeneric");
}
