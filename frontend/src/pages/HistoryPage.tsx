import { useEffect, useRef, useState } from "react";

import { listEvaluationRequests, type EvaluationResultFilter } from "../api/evaluationRequests";
import { listProjects } from "../api/projects";
import { projectInitials } from "../features/projects/ProjectOverview";
import { useRole } from "../store/RoleContext";
import type { EvaluationRequest, EvaluationRequestStatus } from "../types/evaluation";
import type { ProjectRef } from "../types/project";
import { formatSlot } from "../utils/dateTime";
import { EVALUATION_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/history.css";

type LoadState = "loading" | "ready" | "error";
type Viewer = "student" | "hitchhiker";
type Tone = "green" | "red" | "violet" | "grey";

// api-plan §5.7: default page size.
const PAGE_SIZE = 20;

type HistoryFilter = "all" | "passed" | "failed" | "pending" | "cancelled" | "expired";

// One chip per outcome shown on the cards, with the API filters behind it (api-plan §10.4).
// A finished evaluation is `confirmed`; "Result pending" is one without a recorded result yet
// (`status=confirmed&result=none`).
const historyFilters: {
  value: HistoryFilter;
  label: string;
  status?: EvaluationRequestStatus[];
  result?: EvaluationResultFilter[];
}[] = [
  { value: "all", label: "All" },
  { value: "passed", label: "Passed", status: ["confirmed"], result: ["passed"] },
  { value: "failed", label: "Failed", status: ["confirmed"], result: ["failed"] },
  { value: "pending", label: "Result pending", status: ["confirmed"], result: ["none"] },
  { value: "cancelled", label: "Cancelled", status: ["cancelled"] },
  { value: "expired", label: "Expired", status: ["expired"] },
];

const dateFormat: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, dateFormat);
}

// Results are entered manually by the team in the Django admin; until then `result` is null.
function outcome(request: EvaluationRequest): { label: string; tone: Tone } {
  if (request.status === "cancelled") {
    return { label: "Cancelled", tone: "grey" };
  }

  if (request.status === "expired") {
    return { label: "Expired", tone: "grey" };
  }

  if (request.result === "passed") {
    return { label: "Passed", tone: "green" };
  }

  if (request.result === "failed") {
    return { label: "Failed", tone: "red" };
  }

  return { label: "Result pending", tone: "violet" };
}

function otherPerson(request: EvaluationRequest, viewer: Viewer) {
  if (viewer === "student") {
    return request.picked_by ? `Hitchhiker: ${request.picked_by.display_name}` : null;
  }

  // `student` can be null when the API hides it (R15, api-plan §8.7).
  return request.student ? `Student: ${request.student.display_name}` : null;
}

// What happened and when, e.g. "Cancelled by dkolarov on 12 Oct 2026".
function endNote(request: EvaluationRequest) {
  if (request.status === "cancelled" && request.cancelled_at) {
    const by = request.cancelled_by ? ` by ${request.cancelled_by.display_name}` : "";

    return `Cancelled${by} on ${formatDate(request.cancelled_at)}`;
  }

  if (request.status === "expired" && request.expired_at) {
    return `Expired on ${formatDate(request.expired_at)}`;
  }

  if (request.completed_at) {
    return `Result recorded on ${formatDate(request.completed_at)}`;
  }

  return null;
}

// Sidebar "History" (#218, #219, #220, #221, #222): past evaluations from
// GET /evaluation-requests/?history=true (§10.4), the student's own (`mine`) or the ones the
// Hitchhiker picked (`picked`), with outcome and project filters and pages of 20.
function HistoryPage() {
  const { activeRole } = useRole();
  const viewer: Viewer = activeRole === "HITCHHIKER" ? "hitchhiker" : "student";
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const chosenFilter =
    historyFilters.find((option) => option.value === filter) ?? historyFilters[0];
  const [project, setProject] = useState("");
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [requests, setRequests] = useState<EvaluationRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  // Set by a live refresh: that load runs in the background (no skeleton, and a failure keeps
  // the history already shown).
  const isLiveRefresh = useRef(false);

  // An evaluation ended, was cancelled or expired, or got its result, or the connection is back
  // (§9, #255). The same filters and page are loaded again.
  useLiveRefresh(EVALUATION_EVENTS, () => {
    isLiveRefresh.current = true;
    setReloadKey((key) => key + 1);
  });

  useEffect(() => {
    let active = true;

    listProjects()
      .then((result) => {
        if (active) {
          setProjects(result);
        }
      })
      .catch(() => {
        // The project filter is optional; the history still loads without it.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const inBackground = isLiveRefresh.current;

    isLiveRefresh.current = false;

    if (!inBackground) {
      setLoadState("loading");
    }

    listEvaluationRequests({
      scope: viewer === "student" ? "mine" : "picked",
      history: true,
      status: chosenFilter.status,
      result: chosenFilter.result,
      project: project || undefined,
      page,
    })
      .then((result) => {
        if (active) {
          setRequests(result.results);
          setTotal(result.count);
          setHasNext(result.next !== null);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setLoadState((current) => (inBackground && current === "ready" ? current : "error"));
        }
      });

    return () => {
      active = false;
    };
  }, [viewer, filter, project, page, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered = filter !== "all" || project !== "";

  return (
    <section className="history-page">
      <header className="history-page__header">
        <h1>History</h1>
        <p>
          {viewer === "student"
            ? "Your past evaluations and requests."
            : "The evaluations you picked in the past."}
        </p>
      </header>

      <div className="history-page__filters">
        <div className="history-page__chips" role="group" aria-label="Filter by outcome">
          {historyFilters.map((option) => (
            <button
              key={option.value}
              className={
                option.value === filter
                  ? "history-page__chip history-page__chip--active"
                  : "history-page__chip"
              }
              type="button"
              aria-pressed={option.value === filter}
              onClick={() => {
                setFilter(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="history-page__project">
          <span>Project</span>
          <select
            value={project}
            onChange={(event) => {
              setProject(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All projects</option>
            {projects.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadState === "loading" && (
        <div className="history-page__list" aria-busy="true">
          {[1, 2, 3].map((placeholder) => (
            <div className="history-page__skeleton" key={placeholder} />
          ))}
          <span className="history-page__sr-only">Loading history…</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="history-page__error" role="alert">
          Could not load your history. Please try again later.
        </p>
      )}

      {loadState === "ready" && requests.length === 0 && (
        <div className="history-page__empty">
          <h2>{isFiltered ? "Nothing matches these filters" : "No history yet"}</h2>
          <p>
            {isFiltered
              ? "Try another outcome or project."
              : "Your past evaluations will appear here."}
          </p>
        </div>
      )}

      {loadState === "ready" && requests.length > 0 && (
        <>
          <ul className="history-page__list">
            {requests.map((request) => {
              const result = outcome(request);
              const person = otherPerson(request, viewer);
              const note = endNote(request);

              return (
                <li className={`history-card history-card--${result.tone}`} key={request.id}>
                  <span className="history-card__badge" aria-hidden="true">
                    {projectInitials(request.project.name)}
                  </span>

                  <div className="history-card__main">
                    <div className="history-card__title">
                      <h2>{request.project.name}</h2>
                      <span className="history-card__outcome">{result.label}</span>
                    </div>

                    <p className="history-card__meta">
                      {request.starts_at && request.ends_at ? (
                        <time dateTime={request.starts_at}>
                          {formatSlot(request.starts_at, request.ends_at)}
                        </time>
                      ) : (
                        <span>Requested on {formatDate(request.created_at)}</span>
                      )}
                      {person && <span>{person}</span>}
                    </p>

                    {note && <p className="history-card__note">{note}</p>}

                    {request.feedback && (
                      <blockquote className="history-card__feedback">
                        <span>Feedback</span>
                        <p>{request.feedback}</p>
                      </blockquote>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {pageCount > 1 && (
            <nav className="history-page__pages" aria-label="History pages">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <span aria-hidden="true">‹</span> Previous
              </button>
              <span aria-live="polite">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setPage((current) => current + 1)}
              >
                Next <span aria-hidden="true">›</span>
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default HistoryPage;
