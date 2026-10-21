import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError } from "../api/client";
import { getEvaluationRequest, pickSlot } from "../api/evaluationRequests";
import SlotPicker, {
  type ChosenSlot,
  type SlotFieldErrors,
} from "../features/hitchhiker/SlotPicker";
import {
  DURATION_OPTIONS,
  isStartAllowed,
  MAX_DAYS_AHEAD,
  MIN_LEAD_MINUTES,
} from "../features/hitchhiker/slotRules";
import SuccessDialog from "../features/hitchhiker/SuccessDialog";
import i18n from "../i18n";
import type { EvaluationRequest } from "../types/evaluation";
import { formatSlot, formatTimeAgo } from "../utils/dateTime";
import { EVALUATION_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/pick-slot.css";

type LoadState = "loading" | "ready" | "error";

// How often "now" is refreshed while the page stays open, so a chosen start cannot silently
// become too soon.
const NOW_REFRESH_MS = 30_000;

// Error code (api-plan §5.6) → key of the "pickSlot" texts.
const pickErrorKeys: Record<string, string> = {
  slot_overlaps: "pickSlot.errorOverlaps",
  student_unavailable: "pickSlot.errorStudentUnavailable",
  request_not_pending: "pickSlot.errorNotPending",
  not_eligible: "pickSlot.errorNotEligible",
  cannot_pick_own_request: "pickSlot.errorOwnRequest",
};

function pickErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const key = pickErrorKeys[error.code ?? ""];

    return key ? i18n.t(key) : error.message;
  }

  return i18n.t("pickSlot.errorGeneric");
}

// Hitchhiker "choose a slot" page (Figma "pending requests - details" and "confirm"), #505.
function PickSlotPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [request, setRequest] = useState<EvaluationRequest | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [slot, setSlot] = useState<ChosenSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SlotFieldErrors>({});
  const [isPicked, setIsPicked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Set by a live refresh: a failure then keeps the request already shown.
  const isLiveRefresh = useRef(false);
  // A 404 from a live refresh or from the pick: the request is no longer shown to this
  // Hitchhiker (§5.5).
  const [isGone, setIsGone] = useState(false);

  // Another Hitchhiker picked this request, or the student cancelled it, or the connection is
  // back (§9, #257): the page shows that it is no longer open. Events about other requests are
  // ignored, and so is the Hitchhiker's own pick: its event is sent on commit and usually arrives
  // while the pick is still being sent, before the popup opens.
  useLiveRefresh(EVALUATION_EVENTS, (message) => {
    if (
      isSubmitting ||
      isPicked ||
      (message && "id" in message.data && message.data.id !== Number(id))
    ) {
      return;
    }

    isLiveRefresh.current = true;
    setReloadKey((key) => key + 1);
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

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
          // Another Hitchhiker picked it or the student cancelled it: other Hitchhikers then get
          // 404, not the new status (§5.5).
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

  // A new choice clears the messages about the previous one.
  function chooseSlot(next: ChosenSlot | null) {
    setSlot(next);
    setSubmitError("");
    setFieldErrors({});
  }

  async function handleSubmit() {
    if (!request || !slot) {
      return;
    }

    // Time has passed since the slot was chosen: check the start again before sending it.
    const current = new Date();

    if (!isStartAllowed(slot.start, current)) {
      setNow(current);
      return;
    }

    setSubmitError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await pickSlot(request.id, {
        starts_at: slot.start.toISOString(),
        ends_at: slot.end.toISOString(),
      });
      setIsPicked(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setIsGone(true);
        return;
      }

      if (error instanceof ApiError && error.code === "validation_error") {
        setFieldErrors({
          start: error.fields?.starts_at?.[0],
          duration: error.fields?.ends_at?.[0],
        });
      }

      setSubmitError(pickErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isTooSoon = slot !== null && !isStartAllowed(slot.start, now);

  return (
    <section className="pick-slot">
      <Link className="pick-slot__back" to="/requests">
        <span aria-hidden="true">‹</span> {t("pickSlot.back")}
      </Link>

      {loadState === "loading" && <p className="pick-slot__status">{t("pickSlot.loading")}</p>}

      {loadState === "error" && (
        <p className="pick-slot__error" role="alert">
          {t("pickSlot.loadError")}
        </p>
      )}

      {request && (
        <>
          <header className="pick-slot__header">
            <h1>{t("pickSlot.title", { project: request.project.name })}</h1>
            <p>{t("common.requestedAgo", { time: formatTimeAgo(request.created_at) })}</p>
          </header>

          <div className="pick-slot__layout">
            <div className="pick-slot__main">
              <section className="pick-slot__card">
                <h2>{t("pickSlot.noteTitle")}</h2>
                <p className="pick-slot__note">{request.note || t("common.noNote")}</p>
              </section>

              {request.status === "pending" && !isGone ? (
                <>
                  <section className="pick-slot__card">
                    <h2>{t("pickSlot.yourSlot")}</h2>
                    <SlotPicker now={now} onChange={chooseSlot} errors={fieldErrors} />
                  </section>

                  <div className="pick-slot__summary" aria-live="polite">
                    <span className="pick-slot__check" aria-hidden="true">
                      ✓
                    </span>
                    <div>
                      <strong>{t("pickSlot.selected")}</strong>
                      <p>
                        {slot
                          ? t("pickSlot.selectedValue", {
                              slot: formatSlot(slot.start.toISOString(), slot.end.toISOString()),
                              minutes: slot.durationMinutes,
                            })
                          : t("pickSlot.choosePrompt")}
                      </p>
                    </div>
                  </div>

                  {isTooSoon && (
                    <p className="pick-slot__error" role="alert">
                      {t("pickSlot.tooSoon", { minutes: MIN_LEAD_MINUTES })}
                    </p>
                  )}

                  {submitError && (
                    <p className="pick-slot__error" role="alert">
                      {submitError}
                    </p>
                  )}

                  <div className="pick-slot__actions">
                    <button
                      className="pick-slot__submit"
                      type="button"
                      disabled={!slot || isTooSoon || isSubmitting}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? t("common.sending") : t("common.submit")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="pick-slot__error" role="alert">
                  {isGone ? t("pickSlot.gone") : t("pickSlot.notOpen")}
                </p>
              )}
            </div>

            <aside className="pick-slot__aside">
              <section className="pick-slot__panel">
                <h2>{t("pickSlot.rulesTitle")}</h2>
                <ul>
                  <li>{t("pickSlot.ruleQuarter")}</li>
                  <li>
                    {t("pickSlot.ruleLength", {
                      min: DURATION_OPTIONS[0],
                      max: DURATION_OPTIONS[DURATION_OPTIONS.length - 1],
                    })}
                  </li>
                  <li>{t("pickSlot.ruleLead", { minutes: MIN_LEAD_MINUTES })}</li>
                  <li>{t("pickSlot.ruleAhead", { days: MAX_DAYS_AHEAD })}</li>
                </ul>
              </section>

              <section className="pick-slot__panel pick-slot__panel--tip">
                <h2>{t("pickSlot.nextTitle")}</h2>
                <p>{t("pickSlot.nextText")}</p>
              </section>
            </aside>
          </div>
        </>
      )}

      {isPicked && (
        <SuccessDialog onClose={() => navigate("/requests")}>
          <Trans i18nKey="pickSlot.success" components={{ strong: <strong /> }} />
        </SuccessDialog>
      )}
    </section>
  );
}

export default PickSlotPage;
