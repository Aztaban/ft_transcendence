import type { EvaluationRequest } from "../../types/evaluation";

interface OpenRequestsProps {
  requests: EvaluationRequest[];
}

function OpenRequests({ requests }: OpenRequestsProps) {
  const openRequests = requests.filter(
    (request) => request.status === "pending" || request.status === "awaiting_confirmation",
  );

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
            <article className="dashboard-request" key={request.id}>
              <div>
                <h3>{request.project.name}</h3>
                <p>Evaluation request</p>
              </div>

              <span className="dashboard-request__status">
                {request.status === "awaiting_confirmation" ? "Awaiting confirmation" : "Pending"}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default OpenRequests;
