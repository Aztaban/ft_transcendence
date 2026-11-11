import { useTranslation } from "react-i18next";

import type { EvaluationRequest } from "../../types/evaluation";
import { formatTimeAgo } from "../../utils/dateTime";
import ScrollableList from "../home/ScrollableList";
import Skeleton from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

interface OpenRequestQueueProps {
  requests: EvaluationRequest[];
  // True during the first load: a skeleton instead of the empty state (#258).
  isLoading?: boolean;
}

// The API (scope=open) already returns only requests for projects the Hitchhiker is eligible for.
function OpenRequestQueue({ requests, isLoading = false }: OpenRequestQueueProps) {
  const { t } = useTranslation();
  const openRequests = requests.filter((request) => request.status === "pending");

  return (
    <section
      className="dashboard__section dashboard__section--teal"
      aria-labelledby="open-request-queue-title"
    >
      <h2 id="open-request-queue-title">{t("dashboard.openRequests")}</h2>

      {isLoading ? (
        <Skeleton
          className="dashboard-requests"
          itemClassName="dashboard-requests__skeleton"
          label={t("dashboard.loadingOpen")}
        />
      ) : openRequests.length === 0 ? (
        <EmptyState
          className="dashboard-empty"
          iconClassName="dashboard-empty__history-mark"
          icon="—"
          title={t("hitchhikerRequests.emptyTitle")}
          text={t("dashboard.queueEmpty")}
        />
      ) : (
        <ScrollableList labelledBy="open-request-queue-title">
          {openRequests.map((request) => (
            <article className="dashboard-request" key={request.id}>
              <div>
                <h3>{request.project.name}</h3>
                <p>
                  {t("dashboard.requestedBy", {
                    name: request.student?.display_name ?? t("dashboard.anonymousStudent"),
                    time: formatTimeAgo(request.created_at),
                  })}
                </p>
                {request.note && <p>{request.note}</p>}
              </div>

              <span className="dashboard-request__status">{t("dashboard.open")}</span>
            </article>
          ))}
        </ScrollableList>
      )}
    </section>
  );
}

export default OpenRequestQueue;
