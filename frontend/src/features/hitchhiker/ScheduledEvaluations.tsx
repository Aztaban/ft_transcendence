import { useTranslation } from "react-i18next";

import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";
import ScrollableList from "../home/ScrollableList";
import Skeleton from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

interface ScheduledEvaluationsProps {
  requests: EvaluationRequest[];
  // Who is looking: a student sees the Hitchhiker, a Hitchhiker sees the student.
  viewer: "student" | "hitchhiker";
  // True during the first load: a skeleton instead of the empty state (#258).
  isLoading?: boolean;
}

// Keys of the texts in src/i18n/locales.
const texts = {
  student: {
    title: "pending.title",
    empty: "dashboard.scheduledStudentEmpty",
  },
  hitchhiker: {
    title: "home.upcoming",
    empty: "home.pickedEvaluations",
  },
};

// Confirmed evaluations whose slot has not ended yet, for both dashboards (#209, #215).
function ScheduledEvaluations({ requests, viewer, isLoading = false }: ScheduledEvaluationsProps) {
  const { t } = useTranslation();
  const scheduled = requests.filter(
    (request) => request.status === "confirmed" && !request.is_history,
  );
  const titleId = `scheduled-evaluations-${viewer}-title`;

  return (
    <section className="dashboard__section dashboard__section--blue" aria-labelledby={titleId}>
      <h2 id={titleId}>{t(texts[viewer].title)}</h2>

      {isLoading ? (
        <Skeleton
          className="dashboard-requests"
          itemClassName="dashboard-requests__skeleton"
          label={t("dashboard.loadingScheduled")}
        />
      ) : scheduled.length === 0 ? (
        <EmptyState
          className="dashboard-empty"
          iconClassName="dashboard-empty__history-mark"
          icon="—"
          title={t("pending.emptyTitle")}
          text={t(texts[viewer].empty)}
        />
      ) : (
        <ScrollableList labelledBy={titleId}>
          {scheduled.map((request) => {
            const otherPerson = viewer === "student" ? request.picked_by : request.student;

            return (
              <article className="dashboard-request" key={request.id}>
                <div>
                  <h3>{request.project.name}</h3>
                  {otherPerson && <p>{t("dashboard.with", { name: otherPerson.display_name })}</p>}
                </div>

                {request.starts_at && request.ends_at && (
                  <time className="dashboard-request__status" dateTime={request.starts_at}>
                    {formatSlot(request.starts_at, request.ends_at)}
                  </time>
                )}
              </article>
            );
          })}
        </ScrollableList>
      )}
    </section>
  );
}

export default ScheduledEvaluations;
