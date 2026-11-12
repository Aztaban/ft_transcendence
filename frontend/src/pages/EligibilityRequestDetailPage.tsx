import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { ApiError } from "../api/client";
import {
  getEligibilityRequest,
  reviewEligibilityRequest,
  type EligibilityDecision,
} from "../api/eligibility";
import usePageTitle from "../components/layout/usePageTitle";
import LoadError from "../components/ui/LoadError";
import ReviewDialog from "../features/headTutor/ReviewDialog";
import { reviewErrorMessage } from "../features/headTutor/reviewErrorMessage";
import { useCurrentUser } from "../store/CurrentUserContext";
import { workspacesFor } from "../store/RoleContext";
import type { EligibilityRequest } from "../types/eligibility";
import { formatDate, formatTimeAgo } from "../utils/dateTime";
import { canReviewEligibility } from "../utils/permissions";
import { useLiveRefresh } from "../websocket/LiveProvider";
import NotFoundPage from "./NotFoundPage";
import "../styles/eligibility-review.css";

type LoadState = "loading" | "ready" | "error" | "not-found";

// The badge of the request, singular ("Aprobada", not the tab's "Aprobadas").
const badgeKeys: Record<EligibilityRequest["status"], string> = {
  pending: "review.badgePending",
  approved: "review.badgeApproved",
  declined: "review.badgeDeclined",
};

// "dkolarov" → "DK"
function initials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

// /eligibility-requests/{id}: the page the `eligibility.requested` and `eligibility.decided`
// notifications open (api-plan §8.8). The requester, Head Tutors and Admins see it in any
// workspace; the API answers 404 to anyone else (§10.3), shown as the not found page. A Head Tutor
// or Admin approves or declines a pending request here, except their own (§7.2).
function EligibilityRequestDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const requestId = Number(id);
  usePageTitle(t("eligibilityDetail.title"));
  // The real roles from the shared /users/me/ store; the backend checks them again (§10.3).
  const { user, roles } = useCurrentUser();
  const [request, setRequest] = useState<EligibilityRequest | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  // Set by a live refresh: a failure then keeps the request already shown.
  const isLiveRefresh = useRef(false);
  const [openDecision, setOpenDecision] = useState<EligibilityDecision | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Kept as data and translated at render, so they follow the language switcher.
  const [reviewError, setReviewError] = useState<unknown>(null);
  const [pageError, setPageError] = useState<unknown>(null);
  const [decided, setDecided] = useState<EligibilityDecision | null>(null);

  const refreshInBackground = useCallback(() => {
    isLiveRefresh.current = true;
    setReloadKey((key) => key + 1);
  }, []);

  // This request was decided, or the connection is back (§9.3, §9.4). Events about other requests
  // are ignored. `eligibility.decided` goes to the requester only, so another Head Tutor's
  // decision sends nothing to this one: the page also loads again when the tab is shown (§9.4).
  useLiveRefresh(["eligibility.requested", "eligibility.decided"], (message) => {
    if (message && "id" in message.data && message.data.id !== requestId) {
      return;
    }

    refreshInBackground();
  });

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshInBackground();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshInBackground]);

  useEffect(() => {
    if (!Number.isInteger(requestId) || requestId <= 0) {
      setLoadState("not-found");
      return;
    }

    let active = true;
    const inBackground = isLiveRefresh.current;

    isLiveRefresh.current = false;

    getEligibilityRequest(requestId)
      .then((result) => {
        if (active) {
          setRequest(result);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          if (error instanceof ApiError && error.status === 404) {
            setLoadState("not-found");
          } else {
            setLoadState((current) => (inBackground && current === "ready" ? current : "error"));
          }
        }
      });

    return () => {
      active = false;
    };
  }, [requestId, reloadKey]);

  const closeReview = useCallback(() => {
    if (!isSubmitting) {
      setOpenDecision(null);
      setReviewError(null);
    }
  }, [isSubmitting]);

  async function handleConfirm(reviewNote: string) {
    if (!openDecision || !request) {
      return;
    }

    const decision = openDecision;

    setReviewError(null);
    setIsSubmitting(true);

    try {
      // The answer is the updated request (§10.3), shown as it is.
      const result = await reviewEligibilityRequest(
        request.id,
        reviewNote ? { decision, review_note: reviewNote } : { decision },
      );

      setRequest(result);
      // A background reload that started before the decision (tab shown, reconnect) could answer
      // after it and put the old `pending` request back: starting a new one makes the effect
      // ignore the older answer.
      refreshInBackground();
      setOpenDecision(null);
      setPageError(null);
      setDecided(decision);
    } catch (error) {
      if (error instanceof ApiError && error.code === "eligibility_request_already_reviewed") {
        // Another Head Tutor was faster: close the dialog, explain and show their decision.
        setOpenDecision(null);
        setPageError(error);
        setReloadKey((key) => key + 1);
      } else {
        setReviewError(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadState === "not-found") {
    return <NotFoundPage />;
  }

  const isOwn = request !== null && user !== null && request.requester.id === user.id;
  // The list and the request form open in the Hitchhiker workspace: only offered to someone who
  // has it, so an Admin without a tutor role or a former Hitchhiker never lands on Unauthorized.
  const hasHitchhikerWorkspace = workspacesFor(roles).includes("HITCHHIKER");
  const mayReview = request?.status === "pending" && canReviewEligibility(roles) && !isOwn;

  return (
    <section className="eligibility-review eligibility-detail">
      {canReviewEligibility(roles) && hasHitchhikerWorkspace ? (
        <Link className="eligibility-detail__back" to="/eligibility-requests">
          <span aria-hidden="true">‹</span> {t("eligibilityDetail.backToList")}
        </Link>
      ) : (
        <Link className="eligibility-detail__back" to="/">
          <span aria-hidden="true">‹</span> {t("common.backToHome")}
        </Link>
      )}

      <header className="eligibility-review__header">
        <h1>{t("eligibilityDetail.title")}</h1>
      </header>

      {loadState === "loading" && (
        <div className="eligibility-review__skeleton" aria-busy="true">
          <span className="eligibility-review__sr-only">{t("eligibilityDetail.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <LoadError
          className="eligibility-review__error"
          onRetry={() => {
            setLoadState("loading");
            setReloadKey((key) => key + 1);
          }}
        >
          {t("eligibilityDetail.loadError")}
        </LoadError>
      )}

      {decided && request?.status === decided && (
        <p className="eligibility-review__message" role="status">
          {t(decided === "approved" ? "review.approvedMessage" : "review.declinedMessage", {
            name: request.requester.display_name,
          })}
        </p>
      )}

      {pageError !== null && (
        <p className="eligibility-review__notice" role="alert">
          {reviewErrorMessage(pageError)}
        </p>
      )}

      {request && loadState === "ready" && (
        <article className="eligibility-detail__card">
          <div className="eligibility-detail__top">
            <span className="eligibility-review__person">
              <span className="eligibility-review__avatar" aria-hidden="true">
                {initials(request.requester.display_name)}
              </span>
              <span>
                <span className="eligibility-detail__label">
                  {t("eligibilityDetail.requestedBy")}
                </span>
                <Link to={`/people/${request.requester.id}`}>{request.requester.display_name}</Link>
              </span>
            </span>
            <span
              className={`eligibility-review__status eligibility-review__status--${request.status}`}
            >
              {t(badgeKeys[request.status])}
            </span>
          </div>

          <dl className="eligibility-detail__facts">
            <div>
              <dt>{t("eligibilityDetail.sent")}</dt>
              <dd>
                <time dateTime={request.created_at} title={formatDate(request.created_at)}>
                  {formatTimeAgo(request.created_at)}
                </time>
              </dd>
            </div>
            {request.reviewed_by && (
              <div>
                <dt>{t("eligibilityDetail.reviewedBy")}</dt>
                <dd>{request.reviewed_by.display_name}</dd>
              </div>
            )}
            {request.reviewed_at && (
              <div>
                <dt>{t("eligibilityDetail.decided")}</dt>
                <dd>
                  <time dateTime={request.reviewed_at}>{formatDate(request.reviewed_at)}</time>
                </dd>
              </div>
            )}
          </dl>

          <h2 className="eligibility-detail__subtitle">
            {t("eligibilityDetail.projects", { count: request.projects.length })}
          </h2>
          <ul className="eligibility-review__projects">
            {request.projects.map((project) => (
              <li key={project.id}>{project.name}</li>
            ))}
          </ul>

          {request.review_note && (
            <div className="eligibility-detail__note">
              <h2 className="eligibility-detail__subtitle">{t("eligibilityDetail.note")}</h2>
              <q className="eligibility-review__note">{request.review_note}</q>
            </div>
          )}

          {request.status === "pending" && isOwn && (
            <p className="eligibility-detail__hint">
              {canReviewEligibility(roles)
                ? t("review.errorOwn")
                : t("eligibilityDetail.waitingOwn")}
            </p>
          )}

          {request.status === "approved" && isOwn && (
            <p className="eligibility-detail__hint">{t("eligibilityDetail.approvedOwn")}</p>
          )}

          {request.status === "declined" && isOwn && hasHitchhikerWorkspace && (
            <p className="eligibility-detail__hint">
              {t("eligibilityDetail.declinedOwn")}{" "}
              <Link to="/eligibility-requests/new">{t("eligibilityDetail.sendNew")}</Link>
            </p>
          )}

          {mayReview && (
            <div className="eligibility-review__actions">
              <button
                className="eligibility-review__approve"
                type="button"
                aria-label={t("review.approveAria", { name: request.requester.display_name })}
                onClick={() => setOpenDecision("approved")}
              >
                {t("review.approve")}
              </button>
              <button
                className="eligibility-review__decline"
                type="button"
                aria-label={t("review.declineAria", { name: request.requester.display_name })}
                onClick={() => setOpenDecision("declined")}
              >
                {t("review.decline")}
              </button>
            </div>
          )}
        </article>
      )}

      {openDecision && request && (
        <ReviewDialog
          request={request}
          decision={openDecision}
          isSubmitting={isSubmitting}
          error={reviewError === null ? "" : reviewErrorMessage(reviewError)}
          onConfirm={handleConfirm}
          onClose={closeReview}
        />
      )}
    </section>
  );
}

// The route renders a new page for every request id: moving between requests (the bell, Back)
// then never carries a review popup, its note or a "was approved" banner over to another request.
export function EligibilityRequestRoute() {
  const { id } = useParams();

  return <EligibilityRequestDetailPage key={id} />;
}

export default EligibilityRequestDetailPage;
