import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface AwaitingConfirmationProps {
  requests: EvaluationRequest[];
  // True during the first load: a skeleton instead of the empty state (#258).
  isLoading?: boolean;
}

// Slots the Hitchhiker proposed (scope=picked) that the student has not answered yet.
function AwaitingConfirmation({ requests, isLoading = false }: AwaitingConfirmationProps) {
  const awaitingRequests = requests.filter((request) => request.status === "awaiting_confirmation");

  return (
    <section
      className="dashboard__section dashboard__section--amber"
      aria-labelledby="awaiting-confirmation-title"
    >
      <h2 id="awaiting-confirmation-title">Awaiting Confirmation</h2>

      {isLoading ? (
        <div className="dashboard-requests" aria-busy="true">
          <div className="dashboard-requests__skeleton" />
          <div className="dashboard-requests__skeleton" />
          <span className="dashboard-requests__sr-only">Loading proposed slots…</span>
        </div>
      ) : awaitingRequests.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>Nothing waiting</h3>
          <p>Slots you propose will wait here until the student confirms them.</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {awaitingRequests.map((request) => (
            <article className="dashboard-request" key={request.id}>
              <div>
                <h3>{request.project.name}</h3>
                <p>Proposed to {request.student?.display_name ?? "the student"}</p>
                {request.starts_at && request.ends_at && (
                  <p>
                    <time dateTime={request.starts_at}>
                      {formatSlot(request.starts_at, request.ends_at)}
                    </time>
                  </p>
                )}
              </div>

              <span className="dashboard-request__status">Waiting for student</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AwaitingConfirmation;
