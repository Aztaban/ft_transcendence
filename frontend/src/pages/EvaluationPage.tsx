import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router";

import hitchhikersIcon from "../assets/figma/hitchhikers.svg";
import { ApiError } from "../api/client";
import {
  cancelEvaluationRequest,
  confirmEvaluationRequest,
  declineEvaluationRequest,
  getEvaluationRequest,
} from "../api/evaluationRequests";
import CancelRequestDialog from "../features/student/CancelRequestDialog";
import { canCancel, cancelErrorMessage } from "../features/student/cancelRequest";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { EvaluationRequest, EvaluationRequestStatus } from "../types/evaluation";
import { EVALUATION_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/evaluation.css";

type LoadState = "loading" | "ready" | "error";

const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

const statusInfo: Record<EvaluationRequestStatus, { label: string; tone: string }> = {
  awaiting_confirmation: { label: "Needs your answer", tone: "warm" },
  confirmed: { label: "Scheduled", tone: "accent" },
  pending: { label: "In the queue", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "muted" },
  expired: { label: "Expired", tone: "muted" },
};

// "minishell" → "MI", "RAG against the machine" → "RA"
function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return `${start.toLocaleTimeString(undefined, timeFormat)} – ${end.toLocaleTimeString(undefined, timeFormat)}`;
}

function durationMinutes(startsAt: string, endsAt: string) {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
}

function answerErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "evaluation_already_started") {
      return "This slot has already started, so it can no longer be accepted.";
    }

    if (error.code === "invalid_state_transition") {
      return "This proposal is no longer waiting for your answer.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

// Rendered into <body>, so it is centered on the screen and above the sidebar and top bar.
function AcceptedDialog({ project, onClose }: { project: string; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="evaluation-dialog" data-testid="evaluation-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="evaluation-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evaluation-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="evaluation-dialog__top">
          <span className="evaluation-dialog__check" aria-hidden="true">
            ✓
          </span>
        </div>
        <div className="evaluation-dialog__body">
          <h2 id="evaluation-dialog-title">
            The evaluation has been accepted by the tutor and confirmed by the student!
          </h2>
          <p>
            Your <strong>{project}</strong> evaluation is now in your Pending Evaluations.
          </p>
          <img src={hitchhikersIcon} alt="" aria-hidden="true" />
          <button className="evaluation-dialog__button" type="button" onClick={onClose}>
            Back to home
          </button>
          <span className="evaluation-dialog__hint">or click anywhere to close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// /evaluations/{id}: the page evaluation notifications open (api-plan §8.8 `target_url`).
// Student view of the Figma "Notification" frame: accept or decline the proposed slot (#507).
function EvaluationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [request, setRequest] = useState<EvaluationRequest | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isBusy, setIsBusy] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [answerError, setAnswerError] = useState("");
  const [isAccepted, setIsAccepted] = useState(false);
  const [wasDeclined, setWasDeclined] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [wasCancelled, setWasCancelled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Set by a live refresh: a failure then keeps the request already shown.
  const isLiveRefresh = useRef(false);
  // A 404 from a live refresh or from Accept / Decline: the request is no longer shown to this
  // user (§5.5).
  const [isGone, setIsGone] = useState(false);

  // This request was picked, confirmed, released, cancelled, expired or changed, or the
  // connection is back (§9, #257). Events about other requests are ignored.
  useLiveRefresh(EVALUATION_EVENTS, (message) => {
    if (message && "id" in message.data && message.data.id !== Number(id)) {
      return;
    }

    isLiveRefresh.current = true;
    setReloadKey((key) => key + 1);
  });

  useEffect(() => {
    let active = true;
    const inBackground = isLiveRefresh.current;

    isLiveRefresh.current = false;

    getEvaluationRequest(Number(id))
      .then((result) => {
        if (active) {
          setRequest(result);
          setIsGone(false);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          if (inBackground && error instanceof ApiError && error.status === 404) {
            setIsGone(true);
          }

          setLoadState((current) => (inBackground && current === "ready" ? current : "error"));
        }
      });

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  async function answer(accept: boolean) {
    if (!request) {
      return;
    }

    setAnswerError("");
    setIsBusy(true);

    try {
      const updated = accept
        ? await confirmEvaluationRequest(request.id)
        : await declineEvaluationRequest(request.id);

      setRequest(updated);
      setIsDeclining(false);

      if (accept) {
        setIsAccepted(true);
      } else {
        setWasDeclined(true);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setIsGone(true);
      } else {
        setAnswerError(answerErrorMessage(error));
      }
    } finally {
      setIsBusy(false);
    }
  }

  // The student ends the request for good (#595, api-plan §7.1).
  async function cancelRequest() {
    if (!request) {
      return;
    }

    setCancelError("");
    setIsCancelling(true);

    try {
      setRequest(await cancelEvaluationRequest(request.id));
      setIsCancelOpen(false);
      setWasCancelled(true);
    } catch (error) {
      setCancelError(cancelErrorMessage(error));
    } finally {
      setIsCancelling(false);
    }
  }

  const closeCancel = useCallback(() => {
    setIsCancelOpen(false);
    setCancelError("");
  }, []);

  const baseStatus = request ? statusInfo[request.status] : null;
  // Only the student who created the request may accept, decline or cancel it (§10.4 "Own
  // student"). The picking Hitchhiker sees the same page without these buttons.
  const isOwnRequest = request?.student != null && request.student.id === user?.id;
  // The Hitchhiker who proposed the slot. Everyone else who is not the student (a Head Tutor,
  // an Admin) gets the same neutral wording.
  const isPicker = request?.picked_by != null && request.picked_by.id === user?.id;
  const status =
    baseStatus && request?.status === "awaiting_confirmation" && !isOwnRequest
      ? { ...baseStatus, label: "Waiting for the student" }
      : baseStatus;

  return (
    <section className="evaluation">
      <Link className="evaluation__back" to="/">
        <span aria-hidden="true">‹</span> Back to home
      </Link>

      {loadState === "loading" && <div className="evaluation__skeleton" aria-busy="true" />}

      {loadState === "error" && (
        <p className="evaluation__error" role="alert">
          This evaluation could not be loaded.
        </p>
      )}

      {isGone && (
        <p className="evaluation__error" role="alert">
          This evaluation is no longer available. It may have been cancelled or declined.
        </p>
      )}

      {request && status && !isGone && (
        <article className={`evaluation__card evaluation__card--${status.tone}`}>
          <header className="evaluation__header">
            <span className={`evaluation__pill evaluation__pill--${status.tone}`}>
              {status.label}
            </span>
            <h1>
              {request.status === "awaiting_confirmation" &&
                (isOwnRequest ? (
                  <>
                    A <strong>HITCHHIKER</strong> has taken your request
                  </>
                ) : isPicker ? (
                  "You proposed a slot"
                ) : (
                  "A slot has been proposed"
                ))}
              {request.status === "confirmed" &&
                (isOwnRequest || isPicker
                  ? "Your evaluation is scheduled"
                  : "The evaluation is scheduled")}
              {request.status === "pending" && "Waiting for a Hitchhiker"}
              {(request.status === "cancelled" || request.status === "expired") &&
                "This request is no longer active"}
            </h1>
          </header>

          <div className="evaluation__project">
            <span className="evaluation__badge" aria-hidden="true">
              {projectInitials(request.project.name)}
            </span>
            <h2>{request.project.name}</h2>
          </div>

          {wasDeclined && request.status === "pending" && (
            <p className="evaluation__notice" role="status">
              You declined that time. Your request is back in the queue, so another Hitchhiker can
              propose a new slot.
            </p>
          )}

          {wasCancelled && request.status === "cancelled" && (
            <p className="evaluation__notice" role="status">
              Your request has been cancelled. You can create a new one anytime.
            </p>
          )}

          {request.status === "awaiting_confirmation" && isPicker && (
            <p className="evaluation__notice">
              The student has to accept or decline your proposal.
            </p>
          )}

          {request.status === "pending" && !wasDeclined && isOwnRequest && (
            <p className="evaluation__notice">
              Your request is in the queue. You will be notified when a Hitchhiker proposes a slot.
            </p>
          )}

          {request.starts_at && request.ends_at && (
            <>
              <dl className="evaluation__details">
                <div className="evaluation__tile">
                  <dt>
                    <span className="evaluation__icon" aria-hidden="true">
                      📅
                    </span>
                    Date
                  </dt>
                  <dd>{formatDay(request.starts_at)}</dd>
                </div>
                <div className="evaluation__tile">
                  <dt>
                    <span className="evaluation__icon" aria-hidden="true">
                      🕒
                    </span>
                    Time
                  </dt>
                  <dd>
                    {formatTimes(request.starts_at, request.ends_at)}
                    <small>{durationMinutes(request.starts_at, request.ends_at)} min</small>
                  </dd>
                </div>
                <div className="evaluation__tile">
                  <dt>
                    <span className="evaluation__icon" aria-hidden="true">
                      👤
                    </span>
                    {isOwnRequest ? "Hitchhiker" : "Student"}
                  </dt>
                  <dd>
                    {isOwnRequest
                      ? request.picked_by?.display_name
                      : (request.student?.display_name ?? "—")}
                  </dd>
                </div>
              </dl>

              <div className="evaluation__tip">
                <span aria-hidden="true">i</span>
                <p>
                  {isOwnRequest
                    ? "Please be on time and prepared. Good luck!"
                    : "Please be on time. The student is counting on you."}
                </p>
              </div>
            </>
          )}

          {answerError && (
            <p className="evaluation__error" role="alert">
              {answerError}
            </p>
          )}

          {request.status === "awaiting_confirmation" && isOwnRequest && (
            <div className="evaluation__actions">
              {isDeclining ? (
                <>
                  <span className="evaluation__question">
                    Decline this time? Another Hitchhiker can then propose a new slot.
                  </span>
                  <button
                    className="evaluation__button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => setIsDeclining(false)}
                  >
                    Keep it
                  </button>
                  <button
                    className="evaluation__button evaluation__button--danger"
                    type="button"
                    disabled={isBusy}
                    onClick={() => answer(false)}
                  >
                    {isBusy ? "Declining…" : "Yes, decline"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="evaluation__button evaluation__button--danger"
                    type="button"
                    disabled={isBusy}
                    onClick={() => setIsDeclining(true)}
                  >
                    <span aria-hidden="true">✕</span> Decline this time
                  </button>
                  <button
                    className="evaluation__button evaluation__button--primary"
                    type="button"
                    disabled={isBusy}
                    onClick={() => answer(true)}
                  >
                    <span aria-hidden="true">✓</span> {isBusy ? "Accepting…" : "Accept"}
                  </button>
                </>
              )}
            </div>
          )}

          {canCancel(request) && isOwnRequest && !isAccepted && (
            <div className="evaluation__cancel">
              <button
                className="evaluation__cancel-button"
                type="button"
                disabled={isBusy}
                onClick={() => setIsCancelOpen(true)}
              >
                Cancel request
              </button>
            </div>
          )}
        </article>
      )}

      {isCancelOpen && request && (
        <CancelRequestDialog
          request={request}
          isSubmitting={isCancelling}
          error={cancelError}
          onConfirm={cancelRequest}
          onClose={closeCancel}
        />
      )}

      {isAccepted && request && (
        <AcceptedDialog project={request.project.name} onClose={() => navigate("/")} />
      )}
    </section>
  );
}

export default EvaluationPage;
