import { useEffect, useRef } from "react";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";

interface EligibilitySentDialogProps {
  onClose: () => void;
}

// Shown after the eligibility request is sent. Closes on a click outside the card or on Escape.
function EligibilitySentDialog({ onClose }: EligibilitySentDialogProps) {
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
          Your request was sent to the <strong>HEAD TUTORS!</strong>
        </p>
        <img
          className="eligibility-dialog__image"
          src={hitchhikersIcon}
          alt=""
          aria-hidden="true"
        />
        <p className="eligibility-dialog__text">
          You will get a notification when they decide. Once approved, you can pick requests for
          these projects.
        </p>
        <p className="eligibility-dialog__hint">Click anywhere to close</p>
      </div>
    </div>
  );
}

export default EligibilitySentDialog;
