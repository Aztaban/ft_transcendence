import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import useDialog from "../../hooks/useDialog";
import { REASON_MAX_LENGTH } from "../../utils/validation";
import "../../styles/reason-dialog.css";

// The colour of the popup: amber for an action that can be undone, green for one that restores
// something, red for one that cannot be undone.
export type ReasonDialogTone = "warning" | "positive" | "danger";

interface ReasonDialogProps {
  title: string;
  // What the action does, read out with the title.
  text: string;
  confirmLabel: string;
  // The confirm button's text while the request runs, e.g. "Cancelling…".
  workingLabel: string;
  tone: ReasonDialogTone;
  isSubmitting: boolean;
  // Translated text of the last failure, shown inside the popup.
  error: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

// Confirms an action that needs a reason for the audit log: an override of an evaluation request
// (api-plan §5.8) or an account action (§10.2). The confirm button waits until a reason is typed;
// the backend checks it again (1–500 characters once trimmed). Cancel and Escape do nothing while
// the request runs.
function ReasonDialog({
  title,
  text,
  confirmLabel,
  workingLabel,
  tone,
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const { t } = useTranslation();
  const close = () => {
    if (!isSubmitting) {
      onClose();
    }
  };
  const cardRef = useDialog<HTMLDivElement>(close);
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return createPortal(
    <div className="reason-dialog" data-testid="reason-dialog-backdrop" onClick={close}>
      <div
        ref={cardRef}
        className={`reason-dialog__card reason-dialog__card--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-dialog-title"
        aria-describedby="reason-dialog-text"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="reason-dialog-title">{title}</h2>
        <p className="reason-dialog__text" id="reason-dialog-text">
          {text}
        </p>

        {/* The label names only the field; the hint is read as its description. */}
        <div className="reason-dialog__reason">
          <label htmlFor="reason-dialog-reason">{t("reasonDialog.reason")}</label>
          <textarea
            id="reason-dialog-reason"
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            aria-describedby="reason-dialog-hint"
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="reason-dialog__hint" id="reason-dialog-hint">
            {t("reasonDialog.hint")}
          </span>
          <span className="reason-dialog__count" aria-live="polite">
            {reason.length} / {REASON_MAX_LENGTH}
          </span>
        </div>

        {error && (
          <p className="reason-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="reason-dialog__actions">
          <button
            className="reason-dialog__cancel"
            type="button"
            disabled={isSubmitting}
            onClick={close}
          >
            {t("common.cancel")}
          </button>
          <button
            className={`reason-dialog__confirm reason-dialog__confirm--${tone}`}
            type="button"
            disabled={isSubmitting || trimmed === ""}
            onClick={() => onConfirm(trimmed)}
          >
            {isSubmitting ? workingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ReasonDialog;
