import { useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";

interface EligibilitySentDialogProps {
  onClose: () => void;
}

// Shown after the eligibility request is sent. Closes on a click outside the card or on Escape.
function EligibilitySentDialog({ onClose }: EligibilitySentDialogProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="eligibility-dialog" data-testid="eligibility-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="eligibility-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eligibility-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <p id="eligibility-dialog-title" className="eligibility-dialog__title">
          <Trans i18nKey="eligibility.sentTitle" components={{ strong: <strong /> }} />
        </p>
        <img
          className="eligibility-dialog__image"
          src={hitchhikersIcon}
          alt=""
          aria-hidden="true"
        />
        <p className="eligibility-dialog__text">{t("eligibility.sentText")}</p>
        <p className="eligibility-dialog__hint">{t("common.clickToClose")}</p>
      </div>
    </div>
  );
}

export default EligibilitySentDialog;
