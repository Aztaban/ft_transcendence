import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import useDialog from "../../hooks/useDialog";
import ProjectOverview from "../projects/ProjectOverview";
import type { EvaluationRequest } from "../../types/evaluation";
import { formatDayHeading, formatStartsIn, formatTime } from "../../utils/dateTime";

interface PreviewDialogProps {
  evaluation: EvaluationRequest;
  otherPerson: { label: string; name: string } | null;
  statusLabel: string;
  onClose: () => void;
}

// Figma "Upcoming Evaluation Details": when, how long until it starts, and the project's topics
// and info (ProjectOverview from #168).
function PreviewDialog({ evaluation, otherPerson, statusLabel, onClose }: PreviewDialogProps) {
  const { t } = useTranslation();
  const cardRef = useDialog<HTMLDivElement>(onClose);
  const { starts_at: startsAt, ends_at: endsAt } = evaluation;

  return createPortal(
    <div className="pending-dialog" data-testid="preview-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="pending-dialog__card pending-dialog__card--preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pending-preview__header">
          <div>
            <p className="pending-preview__eyebrow">{t("pending.previewEyebrow")}</p>
            <h2 id="preview-dialog-title">{evaluation.project.name}</h2>
          </div>
          <button
            className="pending-dialog__close"
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {startsAt && endsAt && (
          <dl className="pending-preview__facts">
            <div>
              <dt>{t("pending.status")}</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>{t("pending.when")}</dt>
              <dd>
                <time dateTime={startsAt}>
                  {formatDayHeading(startsAt)}, {formatTime(startsAt)}–{formatTime(endsAt)}
                </time>
              </dd>
            </div>
            <div className="pending-preview__countdown">
              <dt>{t("pending.startsIn")}</dt>
              <dd>{formatStartsIn(startsAt)}</dd>
            </div>
            {otherPerson && (
              <div>
                <dt>{otherPerson.label}</dt>
                <dd>{otherPerson.name}</dd>
              </div>
            )}
          </dl>
        )}

        <ProjectOverview project={evaluation.project} />
      </div>
    </div>,
    document.body,
  );
}

export default PreviewDialog;
