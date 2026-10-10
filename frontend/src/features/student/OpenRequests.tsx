import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface OpenRequestsProps {
  requests: EvaluationRequest[];
}

function needsConfirmation(request: EvaluationRequest) {
  return request.status === "awaiting_confirmation";
}

function OpenRequests({ requests }: OpenRequestsProps) {
  // Requests waiting for the student's answer are listed first.
  const openRequests = requests
    .filter((request) => request.status === "pending" || needsConfirmation(request))
    .sort((a, b) => Number(needsConfirmation(b)) - Number(needsConfirmation(a)));

  return (
    <section className="dashboard__section" aria-labelledby="open-requests-title">
      <h2 id="open-requests-title">Open Requests</h2>

      {openRequests.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>No open requests</h3>
          <p>Your active evaluation requests will appear here.</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {openRequests.map((request) => (
            <article
              className={
                needsConfirmation(request)
                  ? "dashboard-request dashboard-request--needs-confirmation"
                  : "dashboard-request"
              }
              key={request.id}
            >
              <div>
                <h3>{request.project.name}</h3>

                {needsConfirmation(request) && request.starts_at && request.ends_at ? (
                  <p>
                    {request.picked_by?.display_name} proposed{" "}
                    <time dateTime={request.starts_at}>
                      {formatSlot(request.starts_at, request.ends_at)}
                    </time>
                  </p>
                ) : (
                  <p>Evaluation request</p>
                )}
              </div>

              <span className="dashboard-request__status">
                {needsConfirmation(request) ? "Needs your confirmation" : "Pending"}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default OpenRequests;
