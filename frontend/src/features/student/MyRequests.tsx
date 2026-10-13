import { useEffect, useState } from "react";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot, formatTimeAgo } from "../../utils/dateTime";
import "../../styles/my-requests.css";

type LoadState = "loading" | "ready" | "error";

type Tone = "blue" | "amber" | "teal" | "green" | "red" | "violet" | "grey";

// "minishell" → "MI", "RAG against the machine" → "RA"
function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

// Status labels (api-plan §7.1). Results are entered later in the Django admin, so a past
// confirmed request without `result` is "Result pending".
function statusLabel(request: EvaluationRequest): { label: string; tone: Tone } {
  switch (request.status) {
    case "pending":
      return { label: "Waiting for a Hitchhiker", tone: "blue" };
    case "awaiting_confirmation":
      return { label: "Needs your confirmation", tone: "amber" };
    case "cancelled":
      return { label: "Cancelled", tone: "grey" };
    case "expired":
      return { label: "Expired", tone: "grey" };
  }

  if (!request.is_history) {
    return { label: "Confirmed", tone: "teal" };
  }

  if (request.result === "passed") {
    return { label: "Passed", tone: "green" };
  }

  if (request.result === "failed") {
    return { label: "Failed", tone: "red" };
  }

  return { label: "Result pending", tone: "violet" };
}

function RequestRow({ request }: { request: EvaluationRequest }) {
  const status = statusLabel(request);

  return (
    <li className="my-requests__row">
      <span className="my-requests__badge" aria-hidden="true">
        {projectInitials(request.project.name)}
      </span>

      <div className="my-requests__project">
        <h4>{request.project.name}</h4>
        {request.starts_at && request.ends_at ? (
          <time dateTime={request.starts_at}>{formatSlot(request.starts_at, request.ends_at)}</time>
        ) : (
          <p>Requested {formatTimeAgo(request.created_at)}</p>
        )}
      </div>

      <span className={`my-requests__status my-requests__status--${status.tone}`}>
        {status.label}
      </span>
    </li>
  );
}

// "Your requests" on the student Request page (#189): the student's own requests,
// GET /evaluation-requests/?scope=mine (api-plan §10.4), split into active and past by
// `is_history` (§7.1). Only the first page (20 newest, §5.7) is shown.
// TODO: link each row to /evaluations/{id} once that page (#507) is merged.
function MyRequests() {
  const [requests, setRequests] = useState<EvaluationRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;

    listEvaluationRequests({ scope: "mine" })
      .then((page) => {
        if (active) {
          setRequests(page.results);
          setTotal(page.count);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const activeRequests = requests.filter((request) => !request.is_history);
  const pastRequests = requests.filter((request) => request.is_history);

  return (
    <section className="my-requests" aria-labelledby="my-requests-title">
      <h2 id="my-requests-title">Your requests</h2>

      {loadState === "loading" && (
        <div className="my-requests__list" aria-busy="true">
          {[1, 2].map((placeholder) => (
            <div className="my-requests__skeleton" key={placeholder} />
          ))}
          <span className="my-requests__sr-only">Loading your requests…</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="my-requests__error" role="alert">
          Could not load your requests. Please try again later.
        </p>
      )}

      {loadState === "ready" && requests.length === 0 && (
        <p className="my-requests__empty">You haven't requested an evaluation yet.</p>
      )}

      {loadState === "ready" && requests.length > 0 && (
        <>
          <div className="my-requests__group">
            <h3>Active</h3>
            {activeRequests.length === 0 ? (
              <p className="my-requests__empty">No active requests.</p>
            ) : (
              <ul className="my-requests__list">
                {activeRequests.map((request) => (
                  <RequestRow request={request} key={request.id} />
                ))}
              </ul>
            )}
          </div>

          {pastRequests.length > 0 && (
            <div className="my-requests__group">
              <h3>Past</h3>
              <ul className="my-requests__list">
                {pastRequests.map((request) => (
                  <RequestRow request={request} key={request.id} />
                ))}
              </ul>
            </div>
          )}

          {total > requests.length && (
            <p className="my-requests__more">
              Showing your {requests.length} most recent requests.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default MyRequests;
