import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface ScheduledEvaluationsProps {
  requests: EvaluationRequest[];
  // Who is looking: a student sees the Hitchhiker, a Hitchhiker sees the student.
  viewer: "student" | "hitchhiker";
}

const texts = {
  student: {
    title: "Pending Evaluations",
    empty: "Your confirmed evaluations will appear here.",
  },
  hitchhiker: {
    title: "Upcoming Evaluations",
    empty: "Evaluations you pick and students confirm will appear here.",
  },
};

// Confirmed evaluations whose slot has not ended yet, for both dashboards (#209, #215).
function ScheduledEvaluations({ requests, viewer }: ScheduledEvaluationsProps) {
  const scheduled = requests.filter(
    (request) => request.status === "confirmed" && !request.is_history,
  );
  const titleId = `scheduled-evaluations-${viewer}-title`;

  return (
    <section className="dashboard__section dashboard__section--blue" aria-labelledby={titleId}>
      <h2 id={titleId}>{texts[viewer].title}</h2>

      {scheduled.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>Nothing scheduled yet</h3>
          <p>{texts[viewer].empty}</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {scheduled.map((request) => {
            const otherPerson = viewer === "student" ? request.picked_by : request.student;

            return (
              <article className="dashboard-request" key={request.id}>
                <div>
                  <h3>{request.project.name}</h3>
                  {otherPerson && <p>With {otherPerson.display_name}</p>}
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
