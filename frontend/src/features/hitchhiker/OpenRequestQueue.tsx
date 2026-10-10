import type { EvaluationRequest } from "../../types/evaluation";
import { formatTimeAgo } from "../../utils/dateTime";

interface OpenRequestQueueProps {
  requests: EvaluationRequest[];
}

// The API (scope=open) already returns only requests for projects the Hitchhiker is eligible for.
function OpenRequestQueue({ requests }: OpenRequestQueueProps) {
  const openRequests = requests.filter((request) => request.status === "pending");

  return (
    <section className="dashboard__section" aria-labelledby="open-request-queue-title">
      <h2 id="open-request-queue-title">Open Requests</h2>

      {openRequests.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>No open requests</h3>
          <p>Requests for projects you can evaluate will appear here.</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {openRequests.map((request) => (
            <article className="dashboard-request" key={request.id}>
              <div>
                <h3>{request.project.name}</h3>
                <p>
                  {request.student.display_name} · Requested {formatTimeAgo(request.created_at)}
                </p>
                {request.note && <p>{request.note}</p>}
              </div>

              <span className="dashboard-request__status">Open</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default OpenRequestQueue;
