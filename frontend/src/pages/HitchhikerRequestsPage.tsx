import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { listEvaluationRequests } from "../api/evaluationRequests";
import type { EvaluationRequest } from "../types/evaluation";
import { formatTimeAgo } from "../utils/dateTime";
import { OPEN_QUEUE_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/hitchhiker-requests.css";

type LoadState = "loading" | "ready" | "error";
type SortOrder = "newest" | "oldest";

const ONE_DAY = 24 * 60 * 60 * 1000;

const steps = [
  { title: "Pick a request", text: "Choose a student waiting on a project you can evaluate." },
  { title: "Propose a slot", text: "Suggest a time between 15 and 120 minutes long." },
  { title: "Student confirms", text: "Once confirmed, it moves to your upcoming evaluations." },
];

// "minishell" → "MI", "RAG against the machine" → "RA"
function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

function isWaitingLong(request: EvaluationRequest, now: number) {
  return now - new Date(request.created_at).getTime() > ONE_DAY;
}

// The Hitchhiker's "Requests" page (Figma "pending requests"): open requests for projects they
// are eligible for, from GET /evaluation-requests/?scope=open (api-plan §10.4). It re-fetches
// in the background when the queue changes or after a reconnect (§9, #255).
function HitchhikerRequestsPage() {
  const [requests, setRequests] = useState<EvaluationRequest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [reloadKey, setReloadKey] = useState(0);

  useLiveRefresh(OPEN_QUEUE_EVENTS, () => setReloadKey((key) => key + 1));

  useEffect(() => {
    let active = true;

    // TODO: only the first page (20 requests) is shown; add paging when the queue gets longer.
    listEvaluationRequests({ scope: "open" })
      .then((page) => {
        if (active) {
          setRequests(page.results.filter((request) => request.status === "pending"));
          setLoadState("ready");
        }
      })
      .catch(() => {
        // A failed background refresh keeps the cards already shown.
        if (active && reloadKey === 0) {
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const now = Date.now();

  const projectCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const request of requests) {
      counts.set(request.project.name, (counts.get(request.project.name) ?? 0) + 1);
    }

    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [requests]);

  // A project whose last request just left the queue is no longer a filter.
  const activeFilter = projectCounts.some(([name]) => name === projectFilter)
    ? projectFilter
    : null;

  const visibleRequests = useMemo(() => {
    const filtered = activeFilter
      ? requests.filter((request) => request.project.name === activeFilter)
      : requests;

    return [...filtered].sort((a, b) => {
      const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

      return sortOrder === "oldest" ? difference : -difference;
    });
  }, [requests, activeFilter, sortOrder]);

  const oldestRequest = requests.reduce<EvaluationRequest | null>(
    (oldest, request) =>
      !oldest || new Date(request.created_at) < new Date(oldest.created_at) ? request : oldest,
    null,
  );

  const hasRequests = loadState === "ready" && requests.length > 0;

  return (
    <section className="hitchhiker-requests">
      <header className="hitchhiker-requests__header">
        <h1>Requests</h1>
        <p>Students waiting for a Hitchhiker on projects you can evaluate.</p>
      </header>

      {hasRequests && (
        <dl className="hitchhiker-requests__stats">
          <div className="hitchhiker-requests__stat">
            <dt>Open requests</dt>
            <dd>{requests.length}</dd>
          </div>
          <div className="hitchhiker-requests__stat">
            <dt>Projects</dt>
            <dd>{projectCounts.length}</dd>
          </div>
          <div className="hitchhiker-requests__stat">
            <dt>Longest wait</dt>
            <dd>{oldestRequest ? formatTimeAgo(oldestRequest.created_at) : "—"}</dd>
          </div>
        </dl>
      )}

      <div className="hitchhiker-requests__layout">
        <div className="hitchhiker-requests__main">
          {hasRequests && (
            <div className="hitchhiker-requests__toolbar">
              <div
                className="hitchhiker-requests__chips"
                role="group"
                aria-label="Filter by project"
              >
                <button
                  className="hitchhiker-requests__chip"
                  type="button"
                  aria-pressed={activeFilter === null}
                  onClick={() => setProjectFilter(null)}
                >
                  All <span>{requests.length}</span>
                </button>
                {projectCounts.map(([name, count]) => (
                  <button
                    className="hitchhiker-requests__chip"
                    type="button"
                    key={name}
                    aria-pressed={activeFilter === name}
                    onClick={() => setProjectFilter(name)}
                  >
                    {name} <span>{count}</span>
                  </button>
                ))}
              </div>

              <label className="hitchhiker-requests__sort">
                Sort
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>
          )}

          {loadState === "loading" && (
            <div className="hitchhiker-requests__list" aria-busy="true">
              {[1, 2, 3].map((placeholder) => (
                <div className="hitchhiker-requests__skeleton" key={placeholder} />
              ))}
              <span className="hitchhiker-requests__sr-only">Loading requests…</span>
            </div>
          )}

          {loadState === "error" && (
            <p className="hitchhiker-requests__error" role="alert">
              Could not load the requests. Please try again later.
            </p>
          )}

          {loadState === "ready" && requests.length === 0 && (
            <div className="hitchhiker-requests__empty">
              <h2>No open requests</h2>
              <p>New requests for projects you can evaluate will appear here.</p>
            </div>
          )}

          {loadState === "ready" && visibleRequests.length > 0 && (
            <ul className="hitchhiker-requests__list">
              {visibleRequests.map((request) => (
                <li className="hitchhiker-requests__card" key={request.id}>
                  <span className="hitchhiker-requests__badge" aria-hidden="true">
                    {projectInitials(request.project.name)}
                  </span>

                  <div className="hitchhiker-requests__project">
                    <h2>{request.project.name}</h2>
                    <p>Requested {formatTimeAgo(request.created_at)}</p>
                    {isWaitingLong(request, now) && (
                      <span className="hitchhiker-requests__tag">Waiting a while</span>
                    )}
                  </div>

                  <p className="hitchhiker-requests__note">
                    {request.note || "No note from the student."}
                  </p>

                  <div className="hitchhiker-requests__action">
                    <Link
                      className="hitchhiker-requests__review"
                      to={`/requests/${request.id}`}
                      aria-label={`Review the ${request.project.name} request`}
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="hitchhiker-requests__aside">
          <section className="hitchhiker-requests__panel">
            <h2>How it works</h2>
            <ol className="hitchhiker-requests__steps">
              {steps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="hitchhiker-requests__panel hitchhiker-requests__panel--tip">
            <h2>Tip</h2>
            <p>Requests marked “Waiting a while” have been open for more than a day.</p>
          </section>

          <section className="hitchhiker-requests__panel hitchhiker-requests__panel--projects">
            <h2>Your projects</h2>
            <p>You only see requests for projects you are approved to evaluate.</p>
            <Link className="hitchhiker-requests__projects-link" to="/eligibility-requests/new">
              Request more projects <span aria-hidden="true">→</span>
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default HitchhikerRequestsPage;
