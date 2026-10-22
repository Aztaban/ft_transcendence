import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../api/client";
import {
  listEligibilityRequests,
  reviewEligibilityRequest,
  type EligibilityDecision,
} from "../api/eligibility";
import ReviewDialog from "../features/headTutor/ReviewDialog";
import i18n from "../i18n";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { EligibilityRequest, EligibilityRequestStatus } from "../types/eligibility";
import { formatTimeAgo } from "../utils/dateTime";
import { canReviewEligibility } from "../utils/permissions";
import UnauthorizedPage from "./UnauthorizedPage";
import "../styles/eligibility-review.css";

type LoadState = "loading" | "ready" | "error";

const tabs: EligibilityRequestStatus[] = ["pending", "approved", "declined"];

// Keys of the "review" texts for each status: its name, and the empty list of that tab.
const statusLabels: Record<EligibilityRequestStatus, string> = {
  pending: "review.pending",
  approved: "review.approved",
  declined: "review.declined",
};

const emptyLabels: Record<EligibilityRequestStatus, string> = {
  pending: "review.noPending",
  approved: "review.noApproved",
  declined: "review.noDeclined",
};

interface OpenReview {
  request: EligibilityRequest;
  decision: EligibilityDecision;
}

function reviewErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "cannot_review_own_request") {
      return i18n.t("review.errorOwn");
    }

    if (error.code === "eligibility_request_already_reviewed") {
      return i18n.t("review.errorReviewed");
    }

    return error.fields?.review_note?.[0] ?? error.fields?.decision?.[0] ?? error.message;
  }

  return i18n.t("review.errorGeneric");
}

// "dkolarov" → "DK"
function initials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

// Head Tutor table of eligibility requests (#175, #176, #177): requester and full project list,
// one Approve / Decline decision for the whole request (api-plan §7.2, §10.3).
function EligibilityReviewPage() {
  const { t } = useTranslation();
  // The real roles from the shared /users/me/ store; the backend checks them again (§10.3).
  const { user, roles, isLoaded } = useCurrentUser();
  const userId = user?.id ?? null;
  const allowed = canReviewEligibility(roles);
  const [status, setStatus] = useState<EligibilityRequestStatus>("pending");
  const [requests, setRequests] = useState<EligibilityRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // "Show more" failed: the next click loads the same page again.
  const [moreFailed, setMoreFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [openReview, setOpenReview] = useState<OpenReview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [message, setMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    if (page === 1) {
      setLoadState("loading");
    }

    // Pending: oldest first, the review order. Reviewed tabs: newest requests first (§10.3 has
    // no ordering by decision time).
    listEligibilityRequests(status, {
      ordering: status === "pending" ? undefined : "-created_at",
      page,
    })
      .then((result) => {
        if (active) {
          setRequests((current) => (page === 1 ? result.results : [...current, ...result.results]));
          setTotal(result.count);
          setHasMore(result.next !== null);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          if (page === 1) {
            setLoadState("error");
          } else {
            setMoreFailed(true);
          }
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingMore(false);
        }
      });

    return () => {
      active = false;
    };
  }, [allowed, status, page, reloadKey, retryKey]);

  // Reloads the list from its first page, e.g. after a decision.
  function reload() {
    setPage(1);
    setMoreFailed(false);
    setReloadKey((key) => key + 1);
  }

  function showMore() {
    setIsLoadingMore(true);

    if (moreFailed) {
      setMoreFailed(false);
      setRetryKey((key) => key + 1);
    } else {
      setPage((current) => current + 1);
    }
  }

  const closeReview = useCallback(() => {
    setOpenReview(null);
    setReviewError("");
  }, []);

  async function handleConfirm(reviewNote: string) {
    if (!openReview) {
      return;
    }

    const { request, decision } = openReview;

    setReviewError("");
    setIsSubmitting(true);

    try {
      await reviewEligibilityRequest(
        request.id,
        reviewNote ? { decision, review_note: reviewNote } : { decision },
      );
      setOpenReview(null);
      setPageError("");
      setMessage(
        t(decision === "approved" ? "review.approvedMessage" : "review.declinedMessage", {
          name: request.requester.display_name,
        }),
      );
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.code === "eligibility_request_already_reviewed") {
        // The request is gone from this tab: close the dialog, explain on the page and reload.
        setOpenReview(null);
        setReviewError("");
        setMessage("");
        setPageError(reviewErrorMessage(error));
        reload();
      } else {
        setReviewError(reviewErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoaded) {
    return (
      <section className="eligibility-review" aria-busy="true">
        <span className="eligibility-review__sr-only">{t("review.loading")}</span>
      </section>
    );
  }

  if (!allowed) {
    return <UnauthorizedPage />;
  }

  return (
    <section className="eligibility-review">
      <header className="eligibility-review__header">
        <div>
          <h1>{t("review.title")}</h1>
          <p>{t("review.subtitle")}</p>
        </div>
      </header>

      <div className="eligibility-review__tabs" role="tablist" aria-label={t("review.tabsAria")}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={
              tab === status
                ? `eligibility-review__tab eligibility-review__tab--${tab} eligibility-review__tab--active`
                : `eligibility-review__tab eligibility-review__tab--${tab}`
            }
            type="button"
            role="tab"
            aria-selected={tab === status}
            onClick={() => {
              setStatus(tab);
              setPage(1);
              setMoreFailed(false);
              setMessage("");
              setPageError("");
            }}
          >
            {t(statusLabels[tab])}
            {tab === status && loadState === "ready" && (
              <span className="eligibility-review__tab-count">{total}</span>
            )}
          </button>
        ))}
      </div>

      {message && (
        <p className="eligibility-review__message" role="status">
          {message}
        </p>
      )}

      {pageError && (
        <p className="eligibility-review__notice" role="alert">
          {pageError}
        </p>
      )}

      {loadState === "loading" && (
        <div className="eligibility-review__list" aria-busy="true">
          {[1, 2, 3].map((placeholder) => (
            <div className="eligibility-review__skeleton" key={placeholder} />
          ))}
          <span className="eligibility-review__sr-only">{t("hitchhikerRequests.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="eligibility-review__error" role="alert">
          {t("hitchhikerRequests.error")}
        </p>
      )}

      {loadState === "ready" && requests.length === 0 && (
        <div className="eligibility-review__empty">
          <h2>{t(emptyLabels[status])}</h2>
          {status === "pending" && <p>{t("review.newRequests")}</p>}
        </div>
      )}

      {loadState === "ready" && requests.length > 0 && (
        <table className="eligibility-review__table">
          <thead>
            <tr>
              <th scope="col">{t("review.requester")}</th>
              <th scope="col">{t("review.projects")}</th>
              <th scope="col">{t("review.requested")}</th>
              <th scope="col">
                {status === "pending" ? t("review.decision") : t("review.reviewedBy")}
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const isOwn = request.requester.id === userId;

              return (
                <tr key={request.id}>
                  <td data-label={t("review.requester")}>
                    <span className="eligibility-review__person">
                      <span className="eligibility-review__avatar" aria-hidden="true">
                        {initials(request.requester.display_name)}
                      </span>
                      <span>
                        {request.requester.display_name}
                        {isOwn && (
                          <span className="eligibility-review__own">{t("review.yourRequest")}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td data-label={t("review.projects")}>
                    <ul className="eligibility-review__projects">
                      {request.projects.map((project) => (
                        <li key={project.id}>{project.name}</li>
                      ))}
                    </ul>
                  </td>
                  <td data-label={t("review.requested")}>
                    <time dateTime={request.created_at}>{formatTimeAgo(request.created_at)}</time>
                  </td>
                  <td
                    data-label={
                      status === "pending" ? t("review.decision") : t("review.reviewedBy")
                    }
                  >
                    {request.status === "pending" ? (
                      <div className="eligibility-review__actions">
                        <button
                          className="eligibility-review__approve"
                          type="button"
                          disabled={isOwn}
                          aria-label={t("review.approveAria", {
                            name: request.requester.display_name,
                          })}
                          onClick={() => setOpenReview({ request, decision: "approved" })}
                        >
                          {t("review.approve")}
                        </button>
                        <button
                          className="eligibility-review__decline"
                          type="button"
                          disabled={isOwn}
                          aria-label={t("review.declineAria", {
                            name: request.requester.display_name,
                          })}
                          onClick={() => setOpenReview({ request, decision: "declined" })}
                        >
                          {t("review.decline")}
                        </button>
                      </div>
                    ) : (
                      <div className="eligibility-review__decision">
                        <span
                          className={`eligibility-review__status eligibility-review__status--${request.status}`}
                        >
                          {t(statusLabels[request.status])}
                        </span>
                        {request.reviewed_by && (
                          <span>{t("review.by", { name: request.reviewed_by.display_name })}</span>
                        )}
                        {request.review_note && (
                          <q className="eligibility-review__note">{request.review_note}</q>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {loadState === "ready" && moreFailed && (
        <p className="eligibility-review__notice" role="alert">
          {t("review.moreError")}
        </p>
      )}

      {loadState === "ready" && (hasMore || moreFailed) && (
        <button
          className="eligibility-review__more"
          type="button"
          disabled={isLoadingMore}
          onClick={showMore}
        >
          {isLoadingMore
            ? t("review.loading")
            : t("review.showMore", { count: total - requests.length })}
        </button>
      )}

      {openReview && (
        <ReviewDialog
          request={openReview.request}
          decision={openReview.decision}
          isSubmitting={isSubmitting}
          error={reviewError}
          onConfirm={handleConfirm}
          onClose={closeReview}
        />
      )}
    </section>
  );
}

export default EligibilityReviewPage;
