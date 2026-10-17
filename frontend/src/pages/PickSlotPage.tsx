import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError } from "../api/client";
import { getEvaluationRequest, pickSlot } from "../api/evaluationRequests";
import SlotPicker, { type ChosenSlot } from "../features/hitchhiker/SlotPicker";
import SuccessDialog from "../features/hitchhiker/SuccessDialog";
import type { EvaluationRequest } from "../types/evaluation";
import { formatSlot, formatTimeAgo } from "../utils/dateTime";
import { EVALUATION_EVENTS } from "../websocket/events";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/pick-slot.css";

type LoadState = "loading" | "ready" | "error";

const pickErrorMessages: Record<string, string> = {
  slot_overlaps: "You already have an evaluation at that time. Choose another slot.",
  student_unavailable: "The student already has an evaluation at that time. Choose another slot.",
  request_not_pending: "Another Hitchhiker has just picked this request.",
  not_eligible: "You are not eligible to evaluate this project.",
  cannot_pick_own_request: "You cannot pick your own request.",
};

function pickErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return pickErrorMessages[error.code ?? ""] ?? error.message;
  }

  return "Could not send the slot. Please try again.";
}

// Hitchhiker "choose a slot" page (Figma "pending requests - details" and "confirm"), #505.
function PickSlotPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const [request, setRequest] = useState<EvaluationRequest | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [slot, setSlot] = useState<ChosenSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isPicked, setIsPicked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Set by a live refresh: a failure then keeps the request already shown.
  const isLiveRefresh = useRef(false);

  // Another Hitchhiker picked this request, or the student cancelled it, or the connection is
  // back (§9, #257): the page shows that it is no longer open. Events about other requests, and
  // the Hitchhiker's own pick (the popup is open), are ignored.
  useLiveRefresh(EVALUATION_EVENTS, (message) => {
    if (isPicked || (message && "id" in message.data && message.data.id !== Number(id))) {
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
  }, [id, reloadKey]);

  async function handleSubmit() {
    if (!request || !slot) {
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      await pickSlot(request.id, {
        starts_at: slot.start.toISOString(),
        ends_at: slot.end.toISOString(),
      });
      setIsPicked(true);
    } catch (error) {
      setSubmitError(pickErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="pick-slot">
      <Link className="pick-slot__back" to="/requests">
        <span aria-hidden="true">‹</span> Back to requests
      </Link>

      {loadState === "loading" && <p className="pick-slot__status">Loading the request…</p>}

      {loadState === "error" && (
        <p className="pick-slot__error" role="alert">
          This request could not be loaded. It may have been picked or cancelled.
        </p>
      )}

      {request && (
        <>
          <header className="pick-slot__header">
            <h1>Choose a slot for {request.project.name}</h1>
            <p>Requested {formatTimeAgo(request.created_at)}</p>
          </header>

          <div className="pick-slot__layout">
            <div className="pick-slot__main">
              <section className="pick-slot__card">
                <h2>Note from the student</h2>
                <p className="pick-slot__note">{request.note || "No note from the student."}</p>
              </section>

              {request.status === "pending" ? (
                <>
                  <section className="pick-slot__card">
                    <h2>Your slot</h2>
                    <SlotPicker now={now} onChange={setSlot} />
                  </section>

                  <div className="pick-slot__summary" aria-live="polite">
                    <span className="pick-slot__check" aria-hidden="true">
                      ✓
                    </span>
                    <div>
                      <strong>Selected slot</strong>
                      <p>
                        {slot
                          ? `${formatSlot(slot.start.toISOString(), slot.end.toISOString())} (${slot.durationMinutes} min)`
                          : "Choose a day and a start time."}
                      </p>
                    </div>
                  </div>

                  {submitError && (
                    <p className="pick-slot__error" role="alert">
                      {submitError}
                    </p>
                  )}

                  <div className="pick-slot__actions">
                    <button
                      className="pick-slot__submit"
                      type="button"
                      disabled={!slot || isSubmitting}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? "Sending…" : "Submit"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="pick-slot__error" role="alert">
                  This request is no longer open.
                </p>
              )}
            </div>

            <aside className="pick-slot__aside">
              <section className="pick-slot__panel">
                <h2>Slot rules</h2>
                <ul>
                  <li>Starts on :00, :15, :30 or :45</li>
                  <li>Lasts 15 to 120 minutes</li>
                  <li>At least 30 minutes from now</li>
                  <li>At most 14 days ahead</li>
                </ul>
              </section>

              <section className="pick-slot__panel pick-slot__panel--tip">
                <h2>What happens next</h2>
                <p>The student gets your proposal and confirms or declines it.</p>
              </section>
            </aside>
          </div>
        </>
      )}

      {isPicked && (
        <SuccessDialog onClose={() => navigate("/requests")}>
          The request has been picked! <strong>The student has to accept.</strong>
        </SuccessDialog>
      )}
    </section>
  );
}

export default PickSlotPage;
