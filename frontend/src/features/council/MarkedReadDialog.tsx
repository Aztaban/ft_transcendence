import { useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";

interface MarkedReadDialogProps {
  onClose: () => void;
}

// Figma "marks as read". Closes on a click outside the card or on Escape.
function MarkedReadDialog({ onClose }: MarkedReadDialogProps) {
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
    <div className="message-sent" data-testid="marked-read-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="message-sent__card marked-read__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marked-read-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <p id="marked-read-title" className="marked-read__title">
          <Trans i18nKey="council.markedReadTitle" components={{ strong: <strong /> }} />
        </p>
        <img className="marked-read__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
        <p className="message-sent__hint">{t("council.clickToClose")}</p>
      </div>
    </div>
  );
}

export default MarkedReadDialog;
