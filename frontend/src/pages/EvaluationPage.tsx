import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import BackLink from "../components/layout/BackLink";
import usePageTitle from "../components/layout/usePageTitle";
import ReasonDialog from "../components/ui/ReasonDialog";
import Skeleton from "../components/ui/Skeleton";
import hitchhikersIcon from "../assets/figma/hitchhikers.svg";
import { ApiError } from "../api/client";
import { getTutorEligibility } from "../api/eligibility";
import {
  cancelEvaluationRequest,
  confirmEvaluationRequest,
  declineEvaluationRequest,
  getEvaluationRequest,
  overrideCancelEvaluationRequest,
  overrideReleaseEvaluationRequest,
} from "../api/evaluationRequests";
import { projectInitials } from "../features/projects/ProjectOverview";
import CancelRequestDialog from "../features/student/CancelRequestDialog";
import { canCancel, cancelErrorMessage } from "../features/student/cancelRequest";
import useDialog from "../hooks/useDialog";
import i18n, { dateLocale } from "../i18n";
import { useCurrentUser } from "../store/CurrentUserContext";
import { useRole } from "../store/RoleContext";
import type { EvaluationRequest, EvaluationRequestStatus } from "../types/evaluation";
import { canOverrideEvaluations } from "../utils/permissions";
import { EVALUATION_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/evaluation.css";

type LoadState = "loading" | "ready" | "error";
// What a Head Tutor or Admin may do to someone else's request (an override, api-plan §5.8).
type OverrideAction = "release" | "cancel";
// The states a request can be cancelled from (§10.4).
const CANCELLABLE: readonly EvaluationRequestStatus[] = [
  "pending",
  "awaiting_confirmation",
  "confirmed",
];

const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

// `labelKey` is a key of the "status" texts.
const statusInfo: Record<EvaluationRequestStatus, { labelKey: string; tone: string }> = {
  awaiting_confirmation: { labelKey: "status.needsAnswer", tone: "warm" },
  confirmed: { labelKey: "status.scheduled", tone: "accent" },
  pending: { labelKey: "status.inQueue", tone: "neutral" },
  cancelled: { labelKey: "status.cancelled", tone: "muted" },
  expired: { labelKey: "status.expired", tone: "muted" },
};

// Where a confirmed evaluation stands (#804). `status` stays "confirmed" after the slot, so the
// page also looks at the result and the time: a recorded result, an ended slot waiting for its
// result, a slot running now, or one still ahead.
type ConfirmedPhase = "passed" | "failed" | "resultPending" | "inProgress" | "upcoming";

const phaseInfo: Record<Exclude<ConfirmedPhase, "upcoming">, { labelKey: string; tone: string }> = {
  passed: { labelKey: "status.passed", tone: "success" },
  failed: { labelKey: "status.failed", tone: "danger" },
  resultPending: { labelKey: "status.resultPending", tone: "neutral" },
  inProgress: { labelKey: "status.inProgress", tone: "accent" },
};

function confirmedPhase(request: EvaluationRequest, now: number): ConfirmedPhase | null {
  if (request.status !== "confirmed") {
    return null;
  }

  if (request.result) {
    return request.result;
  }

  if (request.ends_at && Date.parse(request.ends_at) <= now) {
    return "resultPending";
  }

  if (request.starts_at && Date.parse(request.starts_at) <= now) {
    return "inProgress";
  }

  return "upcoming";
}

// The time, once a minute: no event fires when a slot starts or ends.
function useCurrentMinute() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);

    return () => window.clearInterval(timer);
  }, []);

  return now;
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
  const now = useCurrentMinute();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, roles } = useCurrentUser();
  const { availableRoles } = useRole();
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
  // The override popup that is open, what the last override did, and why one was not done.
  const [override, setOverride] = useState<OverrideAction | null>(null);
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState("");
  const [overrideDone, setOverrideDone] = useState<OverrideAction | null>(null);
  const [overrideNotice, setOverrideNotice] = useState("");
  const overrideDoneRef = useRef<HTMLParagraphElement>(null);

  // "push_swap · Evaluation · 42 Evals" once the request is loaded.
  usePageTitle(
    request ? `${request.project.name} · ${t("pageTitle.evaluation")}` : t("pageTitle.evaluation"),
  );
  // Set by a live refresh: a failure then keeps the request already shown.
  const isLiveRefresh = useRef(false);
  // A 404 from loading, a live refresh or Accept / Decline: the request is no longer shown to this
  // user (§5.5), e.g. another Hitchhiker picked it before this one opened the notification (#691).
  const [isGone, setIsGone] = useState(false);
  // The ids of the projects the user may evaluate (GET /tutors/{id}/eligibility/, §10.3), `null`
  // until loaded. Loaded only when the "Pick a slot" link could apply.
  const [eligibleProjectIds, setEligibleProjectIds] = useState<number[] | null>(null);

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
          const notFound = error instanceof ApiError && error.status === 404;

          // A 404 always means gone. Any other failure clears an old "gone" from a previous
          // request (#691), except in a background refresh, which keeps what is shown, like
          // `loadState` below.
          setIsGone((current) => notFound || (inBackground && current));
          setLoadState((current) => (inBackground && current === "ready" ? current : "error"));
        }
      });

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  // Only the student who created the request may accept, decline or cancel it (§10.4 "Own
  // student"). The picking Hitchhiker sees the same page without these buttons.
  const isOwnRequest = request?.student != null && request.student.id === user?.id;
  // The `evaluation.created` notification opens this page (§8.8), but slots are picked on
  // /requests/{id}, so a Hitchhiker gets a link there (#690). Checked against the workspaces the user
  // has, not the active one, and only once /users/me/ has answered.
  const mayPickSlot =
    user !== null &&
    request?.status === "pending" &&
    !isOwnRequest &&
    availableRoles.includes("HITCHHIKER");
  const userId = user?.id;

  // A Head Tutor or Admin sees every request (§5.6 `not_eligible`), also for projects they may not
  // evaluate, so the link also needs their eligibility for this project. Without it, the pick page
  // would not find the request and call it no longer available.
  useEffect(() => {
    if (!mayPickSlot || userId === undefined) {
      return;
    }

    let active = true;

    getTutorEligibility(userId)
      .then((projects) => {
        if (active) {
          setEligibleProjectIds(projects.map((project) => project.id));
        }
      })
      .catch(() => {
        // Without the list there is no link; the rest of the page is unaffected.
      });

    return () => {
      active = false;
    };
  }, [mayPickSlot, userId]);

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

  // The override buttons change with the request (Release goes once the slot is released, both
  // go once it is cancelled), so the focus moves to the result instead of the page top.
  useEffect(() => {
    if (overrideDone) {
      overrideDoneRef.current?.focus();
    }
  }, [overrideDone]);

  function openOverride(action: OverrideAction) {
    setOverride(action);
    setOverrideError("");
    setOverrideDone(null);
    setOverrideNotice("");
  }

  const closeOverride = useCallback(() => {
    setOverride(null);
    setOverrideError("");
  }, []);

  // A Head Tutor or Admin releases or cancels someone else's request with a reason (§10.4).
  async function confirmOverride(reason: string) {
    if (!request || !override) {
      return;
    }

    setOverrideError("");
    setIsOverriding(true);

    try {
      const updated =
        override === "release"
          ? await overrideReleaseEvaluationRequest(request.id, reason)
          : await overrideCancelEvaluationRequest(request.id, reason);

      setRequest(updated);
      setOverride(null);
      setOverrideDone(override);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setOverride(null);
        setIsGone(true);
      } else if (
        error instanceof ApiError &&
        (error.code === "evaluation_already_started" || error.code === "invalid_state_transition")
      ) {
        // The slot started or the request changed meanwhile: say so and show it as it is now. A
        // background load keeps the request on screen if it fails.
        setOverride(null);
        setOverrideNotice(
          error.code === "evaluation_already_started"
            ? t("evaluation.override.alreadyStarted")
            : t("evaluation.override.changed"),
        );
        isLiveRefresh.current = true;
        setReloadKey((key) => key + 1);
      } else if (error instanceof ApiError && error.code === "validation_error") {
        setOverrideError(error.fields?.reason?.[0] ?? error.message);
      } else {
        setOverrideError(t("evaluation.override.error"));
      }
    } finally {
      setIsOverriding(false);
    }
  }

  const phase = request ? confirmedPhase(request, now) : null;
  const isOver = phase === "passed" || phase === "failed" || phase === "resultPending";
  const baseStatus = request
    ? phase && phase !== "upcoming"
      ? phaseInfo[phase]
      : statusInfo[request.status]
    : null;
  // The Hitchhiker who proposed the slot. Everyone else who is not the student (a Head Tutor,
  // an Admin) gets the same neutral wording.
  const isPicker = request?.picked_by != null && request.picked_by.id === user?.id;
  const canPickSlot =
    mayPickSlot &&
    request !== null &&
    eligibleProjectIds !== null &&
    eligibleProjectIds.includes(request.project.id);
  // An override is a Head Tutor or Admin acting on someone else's request (§5.8). As the student
  // or the picking Hitchhiker they use the normal buttons instead.
  const mayOverride =
    request !== null && canOverrideEvaluations(roles) && !isOwnRequest && !isPicker;
  // Release only before the slot starts; cancel at any time, unless a result is recorded (§10.4).
  const canOverrideRelease =
    mayOverride &&
    request !== null &&
    (request.status === "awaiting_confirmation" || request.status === "confirmed") &&
    request.starts_at !== null &&
    new Date(request.starts_at).getTime() > Date.now();
  const canOverrideCancel =
    mayOverride &&
    request !== null &&
    CANCELLABLE.includes(request.status) &&
    request.result === null;
  const status =
    baseStatus && request?.status === "awaiting_confirmation" && !isOwnRequest
      ? { ...baseStatus, labelKey: "status.waitingForStudent" }
      : baseStatus;

  return (
    <section className="evaluation">
      <BackLink className="evaluation__back" />

      {loadState === "loading" && (
        <Skeleton
          label={t("evaluation.loading")}
          count={1}
          className="evaluation__loading"
          itemClassName="evaluation__skeleton"
        />
      )}

      {loadState === "error" && !isGone && (
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
              {(phase === "passed" || phase === "failed") && t("evaluation.finished")}
              {phase === "resultPending" && t("evaluation.ended")}
              {(phase === "upcoming" || phase === "inProgress") &&
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

          {overrideDone && (
            <p className="evaluation__notice" role="status" tabIndex={-1} ref={overrideDoneRef}>
              {t(`evaluation.override.${overrideDone}Done`)}
            </p>
          )}

          {overrideNotice && (
            <p className="evaluation__error" role="alert">
              {overrideNotice}
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
                      ? (request.picked_by?.display_name ?? "—")
                      : (request.student?.display_name ?? "—")}
                  </dd>
                </div>
              </dl>

              {!isOver && (
                <div className="evaluation__tip">
                  <span aria-hidden="true">i</span>
                  <p>{isOwnRequest ? t("evaluation.tipOwn") : t("evaluation.tipOther")}</p>
                </div>
              )}
            </>
          )}

          {phase === "resultPending" && (
            <p className="evaluation__notice">{t("evaluation.resultPendingNotice")}</p>
          )}

          {request.result && (
            <section
              className={`evaluation__result evaluation__result--${request.result}`}
              aria-labelledby="evaluation-result-title"
            >
              <h3 id="evaluation-result-title">
                {t("evaluation.result")}: <strong>{t(`status.${request.result}`)}</strong>
              </h3>
              {request.completed_at && (
                <p>{t("history.resultOn", { date: formatDay(request.completed_at) })}</p>
              )}
              {request.feedback && (
                <blockquote className="evaluation__feedback">
                  <span>{t("history.feedback")}</span>
                  <p>{request.feedback}</p>
                </blockquote>
              )}
            </section>
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

          {canPickSlot && (
            <div className="evaluation__actions">
              <Link
                className="evaluation__button evaluation__button--primary"
                to={`/requests/${request.id}`}
              >
                {t("evaluation.pickSlot")}
              </Link>
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

          {(canOverrideRelease || canOverrideCancel) && (
            <section className="evaluation__override" aria-labelledby="evaluation-override-title">
              <h2 id="evaluation-override-title">{t("evaluation.override.title")}</h2>
              <p>{t("evaluation.override.text")}</p>
              <div className="evaluation__override-buttons">
                {canOverrideRelease && (
                  <button
                    className="evaluation__button"
                    type="button"
                    onClick={() => openOverride("release")}
                  >
                    {t("evaluation.override.release")}
                  </button>
                )}
                {canOverrideCancel && (
                  <button
                    className="evaluation__button evaluation__button--danger"
                    type="button"
                    onClick={() => openOverride("cancel")}
                  >
                    {t("evaluation.override.cancel")}
                  </button>
                )}
              </div>
            </section>
          )}
        </article>
      )}

      {override && request && (
        <ReasonDialog
          title={t(`evaluation.override.${override}Title`, { project: request.project.name })}
          text={t(`evaluation.override.${override}Text`)}
          confirmLabel={t(`evaluation.override.${override}Confirm`)}
          workingLabel={t(`evaluation.override.${override}Working`)}
          tone={override === "cancel" ? "danger" : "warning"}
          isSubmitting={isOverriding}
          error={overrideError}
          onConfirm={confirmOverride}
          onClose={closeOverride}
        />
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
