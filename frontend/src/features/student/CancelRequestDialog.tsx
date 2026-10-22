import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";
import "../../styles/cancel-request.css";

interface CancelRequestDialogProps {
  request: EvaluationRequest;
  isSubmitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}

// What cancelling ends, by state (api-plan §7.1): the request leaves the queue, or the proposed
// or scheduled slot is given up too.
function consequence(request: EvaluationRequest) {
  if (request.status === "awaiting_confirmation") {
    return "The proposed slot is dropped and the Hitchhiker is told.";
  }

  if (request.status === "confirmed") {
    return "The evaluation is cancelled and the Hitchhiker is told.";
  }

  return "Hitchhikers won't see the request anymore.";
}

// Asks before a student cancels their request (#595). Cancelling is final; the student can
// create a new request afterwards. Closes on Escape or a click outside while not sending.
function CancelRequestDialog({
  request,
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: CancelRequestDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  return createPortal(
    <div
      className="cancel-request"
      data-testid="cancel-request-backdrop"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={cardRef}
        className="cancel-request__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-request-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cancel-request-title">Cancel this request?</h2>

        <div className="cancel-request__summary">
          <strong>{request.project.name}</strong>
          {request.starts_at && request.ends_at && (
            <time dateTime={request.starts_at}>
              {formatSlot(request.starts_at, request.ends_at)}
            </time>
          )}
        </div>

        <p className="cancel-request__text">
          {consequence(request)} This can't be undone, but you can create a new request anytime.
        </p>

        {error && (
          <p className="cancel-request__error" role="alert">
            {error}
          </p>
        )}

        <div className="cancel-request__actions">
          <button
            className="cancel-request__keep"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Keep request
          </button>
          <button
            className="cancel-request__confirm"
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isSubmitting ? "Cancelling…" : "Cancel request"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CancelRequestDialog;
