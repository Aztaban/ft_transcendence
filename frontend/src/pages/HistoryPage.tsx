import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { listEvaluationRequests, type EvaluationResultFilter } from "../api/evaluationRequests";
import { listProjects } from "../api/projects";
import { projectInitials } from "../features/projects/ProjectOverview";
import i18n, { dateLocale } from "../i18n";
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
  // A key of the "history" or "status" texts.
  labelKey: string;
  status?: EvaluationRequestStatus[];
  result?: EvaluationResultFilter[];
}[] = [
  { value: "all", labelKey: "history.all" },
  { value: "passed", labelKey: "status.passed", status: ["confirmed"], result: ["passed"] },
  { value: "failed", labelKey: "status.failed", status: ["confirmed"], result: ["failed"] },
  {
    value: "pending",
    labelKey: "status.resultPending",
    status: ["confirmed"],
    result: ["none"],
  },
  { value: "cancelled", labelKey: "status.cancelled", status: ["cancelled"] },
  { value: "expired", labelKey: "status.expired", status: ["expired"] },
];

const dateFormat: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(dateLocale(), dateFormat);
}

// Results are entered manually by the team in the Django admin; until then `result` is null.
function outcome(request: EvaluationRequest): { label: string; tone: Tone } {
  if (request.status === "cancelled") {
    return { label: i18n.t("status.cancelled"), tone: "grey" };
  }

  if (request.status === "expired") {
    return { label: i18n.t("status.expired"), tone: "grey" };
  }

  if (request.result === "passed") {
    return { label: i18n.t("status.passed"), tone: "green" };
  }

  if (request.result === "failed") {
    return { label: i18n.t("status.failed"), tone: "red" };
  }

  return { label: i18n.t("status.resultPending"), tone: "violet" };
}

function otherPerson(request: EvaluationRequest, viewer: Viewer) {
  if (viewer === "student") {
    return request.picked_by
      ? i18n.t("history.hitchhiker", { name: request.picked_by.display_name })
      : null;
  }

  // `student` can be null when the API hides it (R15, api-plan §8.7).
  return request.student ? i18n.t("history.student", { name: request.student.display_name }) : null;
}

// What happened and when, e.g. "Cancelled by dkolarov on 12 Oct 2026".
function endNote(request: EvaluationRequest) {
  if (request.status === "cancelled" && request.cancelled_at) {
    const date = formatDate(request.cancelled_at);

    return request.cancelled_by
      ? i18n.t("history.cancelledBy", { name: request.cancelled_by.display_name, date })
      : i18n.t("history.cancelledOn", { date });
  }

  if (request.status === "expired" && request.expired_at) {
    return i18n.t("history.expiredOn", { date: formatDate(request.expired_at) });
  }

  if (request.completed_at) {
    return i18n.t("history.resultOn", { date: formatDate(request.completed_at) });
  }

  return null;
}

// Sidebar "History" (#218, #219, #220, #221, #222): past evaluations from
// GET /evaluation-requests/?history=true (§10.4), the student's own (`mine`) or the ones the
// Hitchhiker picked (`picked`), with outcome and project filters and pages of 20.
function HistoryPage() {
  const { t } = useTranslation();
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
        <h1>{t("history.title")}</h1>
        <p>
          {viewer === "student" ? t("history.subtitleStudent") : t("history.subtitleHitchhiker")}
        </p>
      </header>

      <div className="history-page__filters">
        <div className="history-page__chips" role="group" aria-label={t("history.filterAria")}>
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
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        <label className="history-page__project">
          <span>{t("history.project")}</span>
          <select
            value={project}
            onChange={(event) => {
              setProject(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("history.allProjects")}</option>
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
          <span className="history-page__sr-only">{t("history.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="history-page__error" role="alert">
          {t("history.error")}
        </p>
      )}

      {loadState === "ready" && requests.length === 0 && (
        <div className="history-page__empty">
          <h2>{isFiltered ? t("history.emptyFilteredTitle") : t("history.emptyTitle")}</h2>
          <p>{isFiltered ? t("history.emptyFilteredText") : t("history.emptyText")}</p>
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
                        <span>
                          {t("history.requestedOn", { date: formatDate(request.created_at) })}
                        </span>
                      )}
                      {person && <span>{person}</span>}
                    </p>

                    {note && <p className="history-card__note">{note}</p>}

                    {request.feedback && (
                      <blockquote className="history-card__feedback">
                        <span>{t("history.feedback")}</span>
                        <p>{request.feedback}</p>
                      </blockquote>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {pageCount > 1 && (
            <nav className="history-page__pages" aria-label={t("history.pagesAria")}>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <span aria-hidden="true">‹</span> {t("common.previous")}
              </button>
              <span aria-live="polite">{t("history.page", { page, count: pageCount })}</span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("common.next")} <span aria-hidden="true">›</span>
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default HistoryPage;
