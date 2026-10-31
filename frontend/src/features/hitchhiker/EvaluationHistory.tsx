import { useTranslation } from "react-i18next";

import i18n from "../../i18n";
import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface EvaluationHistoryProps {
  requests: EvaluationRequest[];
  // Who is looking: a student sees the Hitchhiker, a Hitchhiker sees the student.
  viewer: "student" | "hitchhiker";
  // True during the first load: a skeleton instead of the empty state (#258).
  isLoading?: boolean;
}

// Results are entered manually by the team in the Django admin; until then `result` is null.
function outcomeLabel(request: EvaluationRequest) {
  if (request.status === "cancelled") {
    return i18n.t("status.cancelled");
  }

  if (request.status === "expired") {
    return i18n.t("status.expired");
  }

  if (request.result === "passed") {
    return i18n.t("status.passed");
  }

  if (request.result === "failed") {
    return i18n.t("status.failed");
  }

  return i18n.t("status.resultPending");
}

function EvaluationHistory({ requests, viewer, isLoading = false }: EvaluationHistoryProps) {
  const { t } = useTranslation();
  const history = requests.filter((request) => request.is_history);

  return (
    <section
      className="dashboard__section dashboard__section--violet"
      aria-labelledby="evaluation-history-title"
    >
      <h2 id="evaluation-history-title">{t("home.history")}</h2>

      {isLoading ? (
        <div className="dashboard-requests" aria-busy="true">
          <div className="dashboard-requests__skeleton" />
          <div className="dashboard-requests__skeleton" />
          <span className="dashboard-requests__sr-only">{t("dashboard.loadingHistory")}</span>
        </div>
      ) : history.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>{t("history.emptyTitle")}</h3>
          <p>{t("history.emptyText")}</p>
        </div>
      ) : (
        <div
          className="dashboard-requests"
          role="group"
          tabIndex={0}
          aria-labelledby="evaluation-history-title"
        >
          {history.map((request) => {
            const otherPerson = viewer === "student" ? request.picked_by : request.student;

            return (
              <article className="dashboard-request" key={request.id}>
                <div>
                  <h3>{request.project.name}</h3>
                  {otherPerson && <p>{t("dashboard.with", { name: otherPerson.display_name })}</p>}
                  {request.starts_at && request.ends_at && (
                    <p>
                      <time dateTime={request.starts_at}>
                        {formatSlot(request.starts_at, request.ends_at)}
                      </time>
                    </p>
                  )}
                </div>

                <span className="dashboard-request__status">{outcomeLabel(request)}</span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default EvaluationHistory;
