import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface EvaluationHistoryProps {
  requests: EvaluationRequest[];
  // Who is looking: a student sees the Hitchhiker, a Hitchhiker sees the student.
  viewer: "student" | "hitchhiker";
}

// Results are entered manually by the team in the Django admin; until then `result` is null.
function outcomeLabel(request: EvaluationRequest) {
  if (request.status === "cancelled") {
    return "Cancelled";
  }

  if (request.status === "expired") {
    return "Expired";
  }

  if (request.result === "passed") {
    return "Passed";
  }

  if (request.result === "failed") {
    return "Failed";
  }

  return "Result pending";
}

function EvaluationHistory({ requests, viewer }: EvaluationHistoryProps) {
  const history = requests.filter((request) => request.is_history);

  return (
    <section className="dashboard__section" aria-labelledby="evaluation-history-title">
      <h2 id="evaluation-history-title">History</h2>

      {history.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>No history yet</h3>
          <p>Your past evaluations will appear here.</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {history.map((request) => {
            const otherPerson = viewer === "student" ? request.picked_by : request.student;

            return (
              <article className="dashboard-request" key={request.id}>
                <div>
                  <h3>{request.project.name}</h3>
                  {otherPerson && <p>With {otherPerson.display_name}</p>}
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
