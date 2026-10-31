import { useTranslation } from "react-i18next";

import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface AwaitingConfirmationProps {
  requests: EvaluationRequest[];
  // True during the first load: a skeleton instead of the empty state (#258).
  isLoading?: boolean;
}

// Slots the Hitchhiker proposed (scope=picked) that the student has not answered yet.
function AwaitingConfirmation({ requests, isLoading = false }: AwaitingConfirmationProps) {
  const { t } = useTranslation();
  const awaitingRequests = requests.filter((request) => request.status === "awaiting_confirmation");

  return (
    <section
      className="dashboard__section dashboard__section--amber"
      aria-labelledby="awaiting-confirmation-title"
    >
      <h2 id="awaiting-confirmation-title">{t("dashboard.awaitingTitle")}</h2>

      {isLoading ? (
        <div className="dashboard-requests" aria-busy="true">
          <div className="dashboard-requests__skeleton" />
          <div className="dashboard-requests__skeleton" />
          <span className="dashboard-requests__sr-only">{t("dashboard.loadingProposed")}</span>
        </div>
      ) : awaitingRequests.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>{t("dashboard.nothingWaiting")}</h3>
          <p>{t("dashboard.awaitingEmpty")}</p>
        </div>
      ) : (
        <div
          className="dashboard-requests"
          role="group"
          tabIndex={0}
          aria-labelledby="awaiting-confirmation-title"
        >
          {awaitingRequests.map((request) => (
            <article className="dashboard-request" key={request.id}>
              <div>
                <h3>{request.project.name}</h3>
                <p>
                  {t("dashboard.proposedTo", {
                    name: request.student?.display_name ?? t("dashboard.theStudent"),
                  })}
                </p>
                {request.starts_at && request.ends_at && (
                  <p>
                    <time dateTime={request.starts_at}>
                      {formatSlot(request.starts_at, request.ends_at)}
                    </time>
                  </p>
                )}
              </div>

              <span className="dashboard-request__status">{t("dashboard.waitingForStudent")}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AwaitingConfirmation;
