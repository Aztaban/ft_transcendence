import { createPortal } from "react-dom";
import { useState } from "react";

import type { EligibilityDecision } from "../../api/eligibility";
import useDialog from "../../hooks/useDialog";
import type { EligibilityRequest } from "../../types/eligibility";

interface ReviewDialogProps {
  request: EligibilityRequest;
  decision: EligibilityDecision;
  isSubmitting: boolean;
  error: string;
  onConfirm: (reviewNote: string) => void;
  onClose: () => void;
}

// api-plan §10.3: `review_note` is optional, up to 500 characters, shown to the requester.
const NOTE_MAX_LENGTH = 500;

// Confirms one decision for the whole request (api-plan §7.2), with an optional note.
function ReviewDialog({
  request,
  decision,
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: ReviewDialogProps) {
  const cardRef = useDialog<HTMLDivElement>(onClose);
  const [note, setNote] = useState("");
  const isApproval = decision === "approved";

  return createPortal(
    <div className="review-dialog" data-testid="review-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className={`review-dialog__card review-dialog__card--${decision}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="review-dialog-title">
          {isApproval ? "Approve" : "Decline"} {request.requester.display_name}'s request?
        </h2>
        <p className="review-dialog__text">
          {isApproval
            ? "They will be able to pick requests for every project below."
            : "They won't be eligible for any project below. They can send a new request."}
        </p>

        <ul className="review-dialog__projects">
          {request.projects.map((project) => (
            <li key={project.id}>{project.name}</li>
          ))}
        </ul>

        <label className="review-dialog__note">
          <span>
            Note for {request.requester.display_name} <em>(optional)</em>
          </span>
          <textarea
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
          />
          <span className="review-dialog__count" aria-live="polite">
            {note.length} / {NOTE_MAX_LENGTH}
          </span>
        </label>

        {error && (
          <p className="review-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="review-dialog__actions">
          <button className="review-dialog__cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`review-dialog__confirm review-dialog__confirm--${decision}`}
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(note.trim())}
          >
            {isSubmitting ? "Saving…" : isApproval ? "Approve" : "Decline"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ReviewDialog;
