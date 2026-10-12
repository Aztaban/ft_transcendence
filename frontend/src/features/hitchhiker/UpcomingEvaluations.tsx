import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface UpcomingEvaluationsProps {
  requests: EvaluationRequest[];
}

// Evaluations the Hitchhiker picked (scope=picked) that the student confirmed and that have not ended yet.
function UpcomingEvaluations({ requests }: UpcomingEvaluationsProps) {
  const upcomingEvaluations = requests.filter(
    (request) => request.status === "confirmed" && !request.is_history,
  );

  return (
    <section className="dashboard__section" aria-labelledby="upcoming-evaluations-title">
      <h2 id="upcoming-evaluations-title">Upcoming Evaluations</h2>

      {upcomingEvaluations.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>Nothing scheduled yet</h3>
          <p>Evaluations you pick and students confirm will appear here.</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {upcomingEvaluations.map((request) => (
            <article className="dashboard-request" key={request.id}>
              <div>
                <h3>{request.project.name}</h3>
                <p>With {request.student.display_name}</p>
              </div>

              {request.starts_at && request.ends_at && (
                <time className="dashboard-request__status" dateTime={request.starts_at}>
                  {formatSlot(request.starts_at, request.ends_at)}
                </time>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default UpcomingEvaluations;
