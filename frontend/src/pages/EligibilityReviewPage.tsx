import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import usePageTitle from "../components/layout/usePageTitle";
import { initials } from "../components/ui/Avatar";
import StatusPill, { type StatusTone } from "../components/ui/StatusPill";
import Tabs from "../components/ui/Tabs";
import { ApiError } from "../api/client";
import {
  listEligibilityRequests,
  reviewEligibilityRequest,
  type EligibilityDecision,
} from "../api/eligibility";
import ReviewDialog from "../features/headTutor/ReviewDialog";
import { reviewErrorMessage } from "../features/headTutor/reviewErrorMessage";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { EligibilityRequest, EligibilityRequestStatus } from "../types/eligibility";
import { formatTimeAgo } from "../utils/dateTime";
import { canReviewEligibility } from "../utils/permissions";
import UnauthorizedPage from "./UnauthorizedPage";
import "../styles/eligibility-review.css";

type LoadState = "loading" | "ready" | "error";

const tabs: EligibilityRequestStatus[] = ["pending", "approved", "declined"];

// Keys of the "review" texts for each status: the tab (a plural heading), and the title and the
// text of its empty list (#370: every tab says what will appear there).
const statusTexts: Record<
  EligibilityRequestStatus,
  { tabKey: string; emptyKey: string; emptyTextKey: string }
> = {
  pending: {
    tabKey: "review.pending",
    emptyKey: "review.noPending",
    emptyTextKey: "review.newRequests",
  },
  approved: {
    tabKey: "review.approved",
    emptyKey: "review.noApproved",
    emptyTextKey: "review.noApprovedText",
  },
  declined: {
    tabKey: "review.declined",
    emptyKey: "review.noDeclined",
    emptyTextKey: "review.noDeclinedText",
  },
};

// The badge of one reviewed request, singular: the tab says "Aprobadas", a row "Aprobada".
const badgeKeys: Record<Exclude<EligibilityRequestStatus, "pending">, string> = {
  approved: "review.badgeApproved",
  declined: "review.badgeDeclined",
};

interface OpenReview {
  request: EligibilityRequest;
  decision: EligibilityDecision;
}

// The last decision, kept as data and translated at render, so it follows the language switcher.
interface Decision {
  decision: EligibilityDecision;
  name: string;
}

// The status pill's colour for each status (#730); the page's classes keep its own look.
const statusTones: Record<EligibilityRequest["status"], StatusTone> = {
  pending: "warning",
  approved: "success",
  declined: "danger",
};

// Head Tutor table of eligibility requests (#175, #176, #177): requester and full project list,
// one Approve / Decline decision for the whole request (api-plan §7.2, §10.3).
function EligibilityReviewPage() {
  const { t } = useTranslation();

  usePageTitle(t("review.title"));
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
  // Errors are kept as they came and translated at render (see `reviewErrorMessage`).
  const [reviewError, setReviewError] = useState<unknown>(null);
  const [message, setMessage] = useState<Decision | null>(null);
  const [pageError, setPageError] = useState<unknown>(null);
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
    setReviewError(null);
  }, []);

  async function handleConfirm(reviewNote: string) {
    if (!openReview) {
      return;
    }

    const { request, decision } = openReview;

    setReviewError(null);
    setIsSubmitting(true);

    try {
      await reviewEligibilityRequest(
        request.id,
        reviewNote ? { decision, review_note: reviewNote } : { decision },
      );
      setOpenReview(null);
      setPageError(null);
      setMessage({ decision, name: request.requester.display_name });
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.code === "eligibility_request_already_reviewed") {
        // The request is gone from this tab: close the dialog, explain on the page and reload.
        setOpenReview(null);
        setReviewError(null);
        setMessage(null);
        setPageError(error);
        reload();
      } else {
        setReviewError(error);
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

      <Tabs
        className="eligibility-review__tabs"
        label={t("review.tabsAria")}
        items={tabs.map((tab) => ({
          id: tab,
          label: (
            <>
              {t(statusTexts[tab].tabKey)}
              {tab === status && loadState === "ready" && (
                <span className="eligibility-review__tab-count">{total}</span>
              )}
            </>
          ),
        }))}
        selected={status}
        tabClassName={(tab, isSelected) =>
          isSelected
            ? `eligibility-review__tab eligibility-review__tab--${tab} eligibility-review__tab--active`
            : `eligibility-review__tab eligibility-review__tab--${tab}`
        }
        onSelect={(tab) => {
          setStatus(tab);
          setPage(1);
          setMoreFailed(false);
          setMessage(null);
          setPageError(null);
        }}
      />

      {message && (
        <p className="eligibility-review__message" role="status">
          {t(
            message.decision === "approved" ? "review.approvedMessage" : "review.declinedMessage",
            { name: message.name },
          )}
        </p>
      )}

      {pageError !== null && (
        <p className="eligibility-review__notice" role="alert">
          {reviewErrorMessage(pageError)}
        </p>
      )}

      {loadState === "loading" && (
        <div className="eligibility-review__list" aria-busy="true">
          {[1, 2, 3].map((placeholder) => (
            <div className="eligibility-review__skeleton" key={placeholder} />
          ))}
          <span className="eligibility-review__sr-only">{t("review.loadingRequests")}</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="eligibility-review__error" role="alert">
          {t("review.loadError")}
        </p>
      )}

      {loadState === "ready" && requests.length === 0 && (
        <div className="eligibility-review__empty">
          <h2>{t(statusTexts[status].emptyKey)}</h2>
          <p>{t(statusTexts[status].emptyTextKey)}</p>
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
                        <StatusPill
                          tone={statusTones[request.status]}
                          className={`eligibility-review__status eligibility-review__status--${request.status}`}
                        >
                          {t(badgeKeys[request.status])}
                        </StatusPill>
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
          error={reviewError === null ? "" : reviewErrorMessage(reviewError)}
          onConfirm={handleConfirm}
          onClose={closeReview}
        />
      )}
    </section>
  );
}

export default EligibilityReviewPage;
