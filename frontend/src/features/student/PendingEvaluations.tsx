import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface PendingEvaluationsProps {
  requests: EvaluationRequest[];
}

function PendingEvaluations({ requests }: PendingEvaluationsProps) {
  const pendingEvaluations = requests.filter(
    (request) => request.status === "confirmed" && !request.is_history,
  );

  return (
    <section className="dashboard__section" aria-labelledby="pending-evaluations-title">
      <h2 id="pending-evaluations-title">Pending Evaluations</h2>

      {pendingEvaluations.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>Nothing scheduled yet</h3>
          <p>Your confirmed evaluations will appear here.</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {pendingEvaluations.map((request) => (
            <article className="dashboard-request" key={request.id}>
              <div>
                <h3>{request.project.name}</h3>
                <p>With {request.picked_by?.display_name}</p>
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

export default PendingEvaluations;
