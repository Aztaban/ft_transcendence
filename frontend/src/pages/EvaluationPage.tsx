import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
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
import i18n, { dateLocale } from "../i18n";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { EvaluationRequest, EvaluationRequestStatus } from "../types/evaluation";
import { EVALUATION_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/evaluation.css";

type LoadState = "loading" | "ready" | "error";

const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

// `labelKey` is a key of the "status" texts.
const statusInfo: Record<EvaluationRequestStatus, { labelKey: string; tone: string }> = {
  awaiting_confirmation: { labelKey: "status.needsAnswer", tone: "warm" },
  confirmed: { labelKey: "status.scheduled", tone: "accent" },
  pending: { labelKey: "status.inQueue", tone: "neutral" },
  cancelled: { labelKey: "status.cancelled", tone: "muted" },
  expired: { labelKey: "status.expired", tone: "muted" },
};

// "minishell" → "MI", "RAG against the machine" → "RA"
function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const locale = dateLocale();

  return `${start.toLocaleTimeString(locale, timeFormat)} – ${end.toLocaleTimeString(locale, timeFormat)}`;
}

function durationMinutes(startsAt: string, endsAt: string) {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
}

function answerErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "evaluation_already_started") {
      return i18n.t("evaluation.errorStarted");
    }

    if (error.code === "invalid_state_transition") {
      return i18n.t("evaluation.errorNotWaiting");
    }

    return error.message;
  }

  return i18n.t("evaluation.errorGeneric");
}

// Rendered into <body>, so it is centered on the screen and above the sidebar and top bar.
function AcceptedDialog({ project, onClose }: { project: string; onClose: () => void }) {
  const { t } = useTranslation();
  const cardRef = useDialog<HTMLDivElement>(onClose);

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
          <h2 id="evaluation-dialog-title">{t("evaluation.acceptedTitle")}</h2>
          <p>
            <Trans
              i18nKey="evaluation.acceptedText"
              values={{ project }}
              components={{ strong: <strong /> }}
            />
          </p>
          <img src={hitchhikersIcon} alt="" aria-hidden="true" />
          <button className="evaluation-dialog__button" type="button" onClick={onClose}>
            {t("common.backToHome")}
          </button>
          <span className="evaluation-dialog__hint">{t("evaluation.orClickToClose")}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// /evaluations/{id}: the page evaluation notifications open (api-plan §8.8 `target_url`).
// Student view of the Figma "Notification" frame: accept or decline the proposed slot (#507).
function EvaluationPage() {
  const { t } = useTranslation();
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
      ? { ...baseStatus, labelKey: "status.waitingForStudent" }
      : baseStatus;

  return (
    <section className="evaluation">
      <Link className="evaluation__back" to="/">
        <span aria-hidden="true">‹</span> {t("common.backToHome")}
      </Link>

      {loadState === "loading" && <div className="evaluation__skeleton" aria-busy="true" />}

      {loadState === "error" && (
        <p className="evaluation__error" role="alert">
          {t("evaluation.loadError")}
        </p>
      )}

      {isGone && (
        <p className="evaluation__error" role="alert">
          {t("evaluation.gone")}
        </p>
      )}

      {request && status && !isGone && (
        <article className={`evaluation__card evaluation__card--${status.tone}`}>
          <header className="evaluation__header">
            <span className={`evaluation__pill evaluation__pill--${status.tone}`}>
              {t(status.labelKey)}
            </span>
            <h1>
              {request.status === "awaiting_confirmation" &&
                (isOwnRequest ? (
                  <Trans i18nKey="evaluation.takenTitle" components={{ strong: <strong /> }} />
                ) : isPicker ? (
                  t("evaluation.proposedByYou")
                ) : (
                  t("evaluation.proposed")
                ))}
              {request.status === "confirmed" &&
                (isOwnRequest || isPicker
                  ? t("evaluation.scheduledOwn")
                  : t("evaluation.scheduledOther"))}
              {request.status === "pending" && t("evaluation.waiting")}
              {(request.status === "cancelled" || request.status === "expired") &&
                t("evaluation.inactive")}
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
              {t("evaluation.declinedNotice")}
            </p>
          )}

          {wasCancelled && request.status === "cancelled" && (
            <p className="evaluation__notice" role="status">
              {t("evaluation.cancelledNotice")}
            </p>
          )}

          {request.status === "awaiting_confirmation" && isPicker && (
            <p className="evaluation__notice">{t("evaluation.pickerNotice")}</p>
          )}

          {request.status === "pending" && !wasDeclined && isOwnRequest && (
            <p className="evaluation__notice">{t("evaluation.queuedNotice")}</p>
          )}

          {request.starts_at && request.ends_at && (
            <>
              <dl className="evaluation__details">
                <div className="evaluation__tile">
                  <dt>
                    <span className="evaluation__icon" aria-hidden="true">
                      📅
                    </span>
                    {t("evaluation.date")}
                  </dt>
                  <dd>{formatDay(request.starts_at)}</dd>
                </div>
                <div className="evaluation__tile">
                  <dt>
                    <span className="evaluation__icon" aria-hidden="true">
                      🕒
                    </span>
                    {t("common.time")}
                  </dt>
                  <dd>
                    {formatTimes(request.starts_at, request.ends_at)}
                    <small>
                      {t("time.minutesShort", {
                        count: durationMinutes(request.starts_at, request.ends_at),
                      })}
                    </small>
                  </dd>
                </div>
                <div className="evaluation__tile">
                  <dt>
                    <span className="evaluation__icon" aria-hidden="true">
                      👤
                    </span>
                    {isOwnRequest ? t("common.hitchhiker") : t("common.student")}
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
                <p>{isOwnRequest ? t("evaluation.tipOwn") : t("evaluation.tipOther")}</p>
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
                  <span className="evaluation__question">{t("evaluation.declineQuestion")}</span>
                  <button
                    className="evaluation__button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => setIsDeclining(false)}
                  >
                    {t("evaluation.keepIt")}
                  </button>
                  <button
                    className="evaluation__button evaluation__button--danger"
                    type="button"
                    disabled={isBusy}
                    onClick={() => answer(false)}
                  >
                    {isBusy ? t("evaluation.declining") : t("evaluation.yesDecline")}
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
                    <span aria-hidden="true">✕</span> {t("evaluation.decline")}
                  </button>
                  <button
                    className="evaluation__button evaluation__button--primary"
                    type="button"
                    disabled={isBusy}
                    onClick={() => answer(true)}
                  >
                    <span aria-hidden="true">✓</span>{" "}
                    {isBusy ? t("evaluation.accepting") : t("evaluation.accept")}
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
                {t("evaluation.cancelRequest")}
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
