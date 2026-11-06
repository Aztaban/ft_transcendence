import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  SC_DELETE_REASON_MAX_LENGTH,
  SC_REVEAL_REASON_MAX_LENGTH,
  SC_REVEAL_REASON_MIN_LENGTH,
} from "../../api/scMessages";
import useDialog from "../../hooks/useDialog";

export type ModerationAction = "delete" | "reveal";

interface ModerationDialogProps {
  action: ModerationAction;
  messageId: number;
  isSubmitting: boolean;
  error: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

// The reason limits from api-plan §10.6, counted like the backend does: without the spaces
// around it.
const LIMITS: Record<ModerationAction, { min: number; max: number }> = {
  delete: { min: 1, max: SC_DELETE_REASON_MAX_LENGTH },
  reveal: { min: SC_REVEAL_REASON_MIN_LENGTH, max: SC_REVEAL_REASON_MAX_LENGTH },
};

// Asks an Admin for the reason before deleting a council message or revealing its sender. The
// reason is required and goes into the audit log (§10.6). Escape and a click outside do nothing
// while the request is being sent.
function ModerationDialog({
  action,
  messageId,
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: ModerationDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const close = () => {
    if (!isSubmitting) {
      onClose();
    }
  };
  const cardRef = useDialog<HTMLDivElement>(close);
  const { min, max } = LIMITS[action];
  const length = reason.trim().length;
  const isValid = length >= min && length <= max;

  return createPortal(
    <div className="moderation-dialog" data-testid="moderation-dialog-backdrop" onClick={close}>
      <div
        ref={cardRef}
        className={`moderation-dialog__card moderation-dialog__card--${action}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="moderation-dialog-title"
        aria-describedby="moderation-dialog-text"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="moderation-dialog-title">
          {t(`council.moderation.${action}Title`, { id: messageId })}
        </h2>
        <p id="moderation-dialog-text" className="moderation-dialog__text">
          {t(`council.moderation.${action}Text`)}
        </p>

        <div className="moderation-dialog__reason">
          <label htmlFor="moderation-dialog-reason">{t("council.moderation.reason")}</label>
          <textarea
            id="moderation-dialog-reason"
            value={reason}
            maxLength={max}
            rows={3}
            aria-describedby="moderation-dialog-hint"
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="moderation-dialog__count">
            <span id="moderation-dialog-hint">
              {t("council.moderation.reasonHint", { count: min })}
            </span>
            <span aria-hidden="true">
              {reason.length} / {max}
            </span>
          </span>
        </div>

        {error && (
          <p className="moderation-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="moderation-dialog__actions">
          <button
            className="moderation-dialog__cancel"
            type="button"
            disabled={isSubmitting}
            onClick={close}
          >
            {t("common.cancel")}
          </button>
          <button
            className={`moderation-dialog__confirm moderation-dialog__confirm--${action}`}
            type="button"
            disabled={!isValid || isSubmitting}
            onClick={() => onConfirm(reason.trim())}
          >
            {isSubmitting ? t("council.saving") : t(`council.moderation.${action}Confirm`)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ModerationDialog;
