import { useTranslation } from "react-i18next";

import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

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
        <div className="dashboard-requests" aria-busy="true">
          <div className="dashboard-requests__skeleton" />
          <div className="dashboard-requests__skeleton" />
          <span className="dashboard-requests__sr-only">{t("dashboard.loadingScheduled")}</span>
        </div>
      ) : scheduled.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>{t("pending.emptyTitle")}</h3>
          <p>{t(texts[viewer].empty)}</p>
        </div>
      ) : (
        <div className="dashboard-requests">
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
        </div>
      )}
    </section>
  );
}

export default ScheduledEvaluations;
