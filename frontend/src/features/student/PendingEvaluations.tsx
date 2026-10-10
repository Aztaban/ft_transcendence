import type { EvaluationRequest } from "../../types/evaluation";

interface PendingEvaluationsProps {
  requests: EvaluationRequest[];
}

// Shows the slot in the user's local time, e.g. "Mon, 12 Oct, 17:00–17:45".
function formatSlot(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return `${day}, ${start.toLocaleTimeString(undefined, time)}–${end.toLocaleTimeString(undefined, time)}`;
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
