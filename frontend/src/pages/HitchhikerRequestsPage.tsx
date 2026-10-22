import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import usePageTitle from "../components/layout/usePageTitle";
import { listEvaluationRequests } from "../api/evaluationRequests";
import { DURATION_OPTIONS } from "../features/hitchhiker/slotRules";
import type { EvaluationRequest } from "../types/evaluation";
import { formatTimeAgo } from "../utils/dateTime";
import { OPEN_QUEUE_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/hitchhiker-requests.css";

type LoadState = "loading" | "ready" | "error";
type SortOrder = "newest" | "oldest";

const ONE_DAY = 24 * 60 * 60 * 1000;

// The texts are "hitchhikerRequests.how<Step>Title" and "hitchhikerRequests.how<Step>Text".
const steps = ["Pick", "Propose", "Confirm"];

// For the "Propose a slot" step: the shortest and longest slot (api-plan §7.1).
const slotLength = {
  min: DURATION_OPTIONS[0],
  max: DURATION_OPTIONS[DURATION_OPTIONS.length - 1],
};

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
  const { t } = useTranslation();

  usePageTitle(t("hitchhikerRequests.title"));
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
        <h1>{t("hitchhikerRequests.title")}</h1>
        <p>{t("hitchhikerRequests.subtitle")}</p>
      </header>

      {hasRequests && (
        <dl className="hitchhiker-requests__stats">
          <div className="hitchhiker-requests__stat">
            <dt>{t("hitchhikerRequests.statOpen")}</dt>
            <dd>{requests.length}</dd>
          </div>
          <div className="hitchhiker-requests__stat">
            <dt>{t("hitchhikerRequests.statProjects")}</dt>
            <dd>{projectCounts.length}</dd>
          </div>
          <div className="hitchhiker-requests__stat">
            <dt>{t("hitchhikerRequests.statWait")}</dt>
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
                aria-label={t("hitchhikerRequests.filterAria")}
              >
                <button
                  className="hitchhiker-requests__chip"
                  type="button"
                  aria-pressed={activeFilter === null}
                  onClick={() => setProjectFilter(null)}
                >
                  {t("hitchhikerRequests.all")} <span>{requests.length}</span>
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
                {t("hitchhikerRequests.sort")}
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                >
                  <option value="newest">{t("hitchhikerRequests.newest")}</option>
                  <option value="oldest">{t("hitchhikerRequests.oldest")}</option>
                </select>
              </label>
            </div>
          )}

          {loadState === "loading" && (
            <div className="hitchhiker-requests__list" aria-busy="true">
              {[1, 2, 3].map((placeholder) => (
                <div className="hitchhiker-requests__skeleton" key={placeholder} />
              ))}
              <span className="hitchhiker-requests__sr-only">
                {t("hitchhikerRequests.loading")}
              </span>
            </div>
          )}

          {loadState === "error" && (
            <p className="hitchhiker-requests__error" role="alert">
              {t("hitchhikerRequests.error")}
            </p>
          )}

          {loadState === "ready" && requests.length === 0 && (
            <div className="hitchhiker-requests__empty">
              <h2>{t("hitchhikerRequests.emptyTitle")}</h2>
              <p>{t("hitchhikerRequests.emptyText")}</p>
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
                    <p>{t("common.requestedAgo", { time: formatTimeAgo(request.created_at) })}</p>
                    {isWaitingLong(request, now) && (
                      <span className="hitchhiker-requests__tag">
                        {t("hitchhikerRequests.waitingLong")}
                      </span>
                    )}
                  </div>

                  <p className="hitchhiker-requests__note">{request.note || t("common.noNote")}</p>

                  <div className="hitchhiker-requests__action">
                    <Link
                      className="hitchhiker-requests__review"
                      to={`/requests/${request.id}`}
                      aria-label={t("hitchhikerRequests.reviewAria", {
                        project: request.project.name,
                      })}
                    >
                      {t("hitchhikerRequests.review")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="hitchhiker-requests__aside">
          <section className="hitchhiker-requests__panel">
            <h2>{t("common.howItWorks")}</h2>
            <ol className="hitchhiker-requests__steps">
              {steps.map((step) => (
                <li key={step}>
                  <strong>{t(`hitchhikerRequests.how${step}Title`)}</strong>
                  <span>{t(`hitchhikerRequests.how${step}Text`, slotLength)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="hitchhiker-requests__panel hitchhiker-requests__panel--tip">
            <h2>{t("common.tip")}</h2>
            <p>{t("hitchhikerRequests.tipText")}</p>
          </section>

          <section className="hitchhiker-requests__panel hitchhiker-requests__panel--projects">
            <h2>{t("hitchhikerRequests.projectsTitle")}</h2>
            <p>{t("hitchhikerRequests.projectsText")}</p>
            <Link className="hitchhiker-requests__projects-link" to="/eligibility-requests/new">
              {t("hitchhikerRequests.projectsLink")} <span aria-hidden="true">→</span>
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default HitchhikerRequestsPage;
