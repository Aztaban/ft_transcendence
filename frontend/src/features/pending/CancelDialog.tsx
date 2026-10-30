import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import useDialog from "../../hooks/useDialog";
import type { EvaluationRequest } from "../../types/evaluation";
import { formatDayHeading, formatTime } from "../../utils/dateTime";

export type PendingViewer = "student" | "hitchhiker";

interface CancelDialogProps {
  evaluation: EvaluationRequest;
  viewer: PendingViewer;
  isDone: boolean;
  isSubmitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}

// Figma "Cancel Eval" and the "slot released" popup. A student cancels the request; the
// Hitchhiker releases the slot and the request goes back to the open requests (api-plan §7.1).
// TODO(contract): Figma asks "Why are you cancelling?", but cancel and release take no body
// (§10.4), so the reasons would not be stored. Left out until the contract has a field.
function CancelDialog({
  evaluation,
  viewer,
  isDone,
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: CancelDialogProps) {
  const { t } = useTranslation();
  const cardRef = useDialog<HTMLDivElement>(onClose);
  const { starts_at: startsAt, ends_at: endsAt } = evaluation;

  if (isDone) {
    return createPortal(
      <div className="pending-dialog" data-testid="released-dialog-backdrop" onClick={onClose}>
        <div
          ref={cardRef}
          className="pending-dialog__card pending-dialog__card--done"
          role="dialog"
          aria-modal="true"
          aria-labelledby="released-dialog-title"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div>
            <h2 id="released-dialog-title">
              <Trans i18nKey="pending.doneTitle" components={{ strong: <strong /> }} />
            </h2>
            <p>{viewer === "student" ? t("pending.doneStudent") : t("pending.doneHitchhiker")}</p>
          </div>
          <img className="pending-dialog__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
          <p className="pending-dialog__hint">{t("common.clickToClose")}</p>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="pending-dialog" data-testid="cancel-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="pending-dialog__card pending-dialog__card--cancel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cancel-dialog-title">{t("pending.cancelTitle")}</h2>

        <div className="pending-cancel__summary">
          <strong>{evaluation.project.name}</strong>
          {startsAt && endsAt && (
            <time dateTime={startsAt}>
              {formatDayHeading(startsAt)}, {formatTime(startsAt)}–{formatTime(endsAt)}
            </time>
          )}
        </div>

        <p className="pending-cancel__text">
          {viewer === "student"
            ? t("pending.cancelTextStudent")
            : t("pending.cancelTextHitchhiker")}
        </p>

        {error && (
          <p className="pending-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="pending-cancel__actions">
          <button className="pending-cancel__keep" type="button" onClick={onClose}>
            {t("pending.keep")}
          </button>
          <button
            className="pending-cancel__confirm"
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isSubmitting ? t("common.cancelling") : t("pending.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CancelDialog;
