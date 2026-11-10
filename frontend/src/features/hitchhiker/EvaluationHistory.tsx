import { useTranslation } from "react-i18next";

import i18n from "../../i18n";
import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";
import ScrollableList from "../home/ScrollableList";
import Skeleton from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

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
        <Skeleton
          className="dashboard-requests"
          itemClassName="dashboard-requests__skeleton"
          label={t("dashboard.loadingHistory")}
        />
      ) : history.length === 0 ? (
        <EmptyState
          className="dashboard-empty"
          iconClassName="dashboard-empty__history-mark"
          icon="—"
          title={t("history.emptyTitle")}
          text={t("history.emptyText")}
        />
      ) : (
        <ScrollableList labelledBy="evaluation-history-title">
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
        </ScrollableList>
      )}
    </section>
  );
}

export default EvaluationHistory;
