import { useTranslation } from "react-i18next";

import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";
import ScrollableList from "../home/ScrollableList";
import Skeleton from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

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
        <Skeleton
          className="dashboard-requests"
          itemClassName="dashboard-requests__skeleton"
          label={t("dashboard.loadingProposed")}
        />
      ) : awaitingRequests.length === 0 ? (
        <EmptyState
          className="dashboard-empty"
          iconClassName="dashboard-empty__history-mark"
          icon="—"
          title={t("dashboard.nothingWaiting")}
          text={t("dashboard.awaitingEmpty")}
        />
      ) : (
        <ScrollableList labelledBy="awaiting-confirmation-title">
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
        </ScrollableList>
      )}
    </section>
  );
}

export default AwaitingConfirmation;
