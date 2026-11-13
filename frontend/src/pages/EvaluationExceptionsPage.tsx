import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { listEvaluationExceptions } from "../api/admin";
import usePageTitle from "../components/layout/usePageTitle";
import i18n from "../i18n";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { EvaluationException, EvaluationRequestStatus } from "../types/evaluation";
import { formatSlot } from "../utils/dateTime";
import { canSeeEvaluationExceptions } from "../utils/permissions";
import UnauthorizedPage from "./UnauthorizedPage";
import "../styles/admin-users.css";

type LoadState = "loading" | "ready" | "error";

// api-plan §5.7: default page size.
const PAGE_SIZE = 20;

// The status as a neutral label for a Head Tutor or Admin, who is neither the student nor the
// Hitchhiker of the request (the "status" texts).
const statusLabelKeys: Record<EvaluationRequestStatus, string> = {
  pending: "status.inQueue",
  awaiting_confirmation: "status.waitingForStudent",
  confirmed: "status.confirmed",
  cancelled: "status.cancelled",
  expired: "status.expired",
};

function slotText(request: EvaluationException) {
  return request.starts_at && request.ends_at
    ? formatSlot(request.starts_at, request.ends_at)
    : i18n.t("exceptions.noSlot");
}

// "Exceptions" (#680): the evaluation requests that need a human decision, from
// GET /admin/evaluation-requests/exceptions/ (api-plan §10.9), newest first in pages of 20. Head
// Tutors open it in the Hitchhiker workspace and Admins in the Admin one. Each row says what is
// wrong and links to the request, where it is resolved.
function EvaluationExceptionsPage() {
  const { t } = useTranslation();

  usePageTitle(t("exceptions.title"));
  // The real roles from the shared /users/me/ store; the backend checks them again (§10.9).
  const { roles, isLoaded } = useCurrentUser();
  const allowed = canSeeEvaluationExceptions(roles);
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<EvaluationException[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    // Not called for anyone else: it would only answer 403 and log an error in the console.
    if (!allowed) {
      return;
    }

    // An answer that arrives after the page changed again is dropped.
    let active = true;

    setLoadState("loading");

    listEvaluationExceptions(page)
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
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [allowed, page]);

  // Until /users/me/ has answered, the roles are unknown, so the page keeps loading.
  if (isLoaded && !allowed) {
    return <UnauthorizedPage />;
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Another page keeps the rows shown, greyed out, until the new ones arrive: the Previous / Next
  // button just used stays in place and keeps the focus (#369).
  const isRefreshing = loadState === "loading" && requests.length > 0;

  return (
    <section className="admin-users">
      <header className="admin-users__header">
        <h1 id="exceptions-title">{t("exceptions.title")}</h1>
        <p>{t("exceptions.subtitle")}</p>
      </header>

      {loadState === "loading" && !isRefreshing && (
        <div className="admin-users__list" aria-busy="true">
          {[1, 2, 3].map((placeholder) => (
            <div className="admin-users__skeleton" key={placeholder} />
          ))}
          <span className="admin-users__sr-only">{t("exceptions.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="admin-users__error" role="alert">
          {t("exceptions.error")}
        </p>
      )}

      {loadState === "ready" && requests.length === 0 && (
        <div className="admin-users__empty">
          <h2>{t("exceptions.emptyTitle")}</h2>
          <p>{t("exceptions.emptyText")}</p>
        </div>
      )}

      {(loadState === "ready" || isRefreshing) && requests.length > 0 && (
        <>
          <div className="admin-users__table-wrap" aria-busy={isRefreshing}>
            <table className="admin-users__table" aria-labelledby="exceptions-title">
              <thead>
                <tr>
                  <th scope="col">{t("exceptions.columns.problem")}</th>
                  <th scope="col">{t("exceptions.columns.request")}</th>
                  <th scope="col">{t("exceptions.columns.student")}</th>
                  <th scope="col">{t("exceptions.columns.hitchhiker")}</th>
                  <th scope="col">{t("exceptions.columns.slot")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td data-label={t("exceptions.columns.problem")}>
                      <div className="exceptions__problem">
                        <span className={`exceptions__badge exceptions__badge--${request.problem}`}>
                          {t(`exceptions.problems.${request.problem}`)}
                        </span>
                        <span className="exceptions__hint">
                          {t(`exceptions.hints.${request.problem}`)}
                        </span>
                      </div>
                    </td>
                    <td data-label={t("exceptions.columns.request")}>
                      <div className="exceptions__request">
                        <Link to={`/evaluations/${request.id}`}>{request.project.name}</Link>
                        <span>{t(statusLabelKeys[request.status])}</span>
                      </div>
                    </td>
                    <td data-label={t("exceptions.columns.student")}>
                      {request.student?.display_name ?? "—"}
                    </td>
                    <td data-label={t("exceptions.columns.hitchhiker")}>
                      {request.picked_by?.display_name ?? "—"}
                    </td>
                    <td data-label={t("exceptions.columns.slot")}>
                      {request.starts_at ? (
                        <time dateTime={request.starts_at}>{slotText(request)}</time>
                      ) : (
                        slotText(request)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <nav className="admin-users__pages" aria-label={t("exceptions.pagesAria")}>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <span aria-hidden="true">‹</span> {t("common.previous")}
              </button>
              <span aria-live="polite">{t("exceptions.page", { page, count: pageCount })}</span>
              <button
                type="button"
                // `hasNext` is the shown page's until the next one arrives: a second quick click
                // must not ask for a page past the last one.
                disabled={!hasNext || page >= pageCount}
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

export default EvaluationExceptionsPage;
