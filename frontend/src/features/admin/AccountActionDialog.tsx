import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { REASON_MAX_LENGTH } from "../../api/admin";
import useDialog from "../../hooks/useDialog";

export type AccountAction = "suspend" | "reactivate" | "delete";

interface AccountActionDialogProps {
  action: AccountAction;
  // The display name of the account the action is for.
  name: string;
  isSubmitting: boolean;
  // Translated text of the last failure, shown inside the popup.
  error: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

// Confirms a suspension, reactivation or deletion (api-plan §10.2). Each needs a reason, so the
// confirm button waits until one is typed; the backend checks it again (1–500 characters).
// Deletion cannot be undone, so its popup says so and its button is red.
function AccountActionDialog({
  action,
  name,
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: AccountActionDialogProps) {
  const { t } = useTranslation();
  const cardRef = useDialog<HTMLDivElement>(onClose);
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return createPortal(
    <div className="account-dialog" data-testid="account-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className={`account-dialog__card account-dialog__card--${action}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        aria-describedby="account-dialog-text"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="account-dialog-title">{t(`adminUser.actions.${action}Title`, { name })}</h2>
        <p className="account-dialog__text" id="account-dialog-text">
          {t(`adminUser.actions.${action}Text`)}
        </p>

        {/* The label names only the field; the hint is read as its description. */}
        <div className="account-dialog__reason">
          <label htmlFor="account-dialog-reason">{t("adminUser.actions.reason")}</label>
          <textarea
            id="account-dialog-reason"
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            aria-describedby="account-dialog-reason-hint"
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="account-dialog__hint" id="account-dialog-reason-hint">
            {t("adminUser.actions.reasonHint")}
          </span>
          <span className="account-dialog__count" aria-live="polite">
            {reason.length} / {REASON_MAX_LENGTH}
          </span>
        </div>

        {error && (
          <p className="account-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="account-dialog__actions">
          <button
            className="account-dialog__cancel"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            className={`account-dialog__confirm account-dialog__confirm--${action}`}
            type="button"
            disabled={isSubmitting || trimmed === ""}
            onClick={() => onConfirm(trimmed)}
          >
            {isSubmitting
              ? t(`adminUser.actions.${action}Working`)
              : t(`adminUser.actions.${action}Confirm`)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default AccountActionDialog;
