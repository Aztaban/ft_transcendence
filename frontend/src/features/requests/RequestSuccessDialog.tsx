import { useEffect, useRef } from "react";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";

interface RequestSuccessDialogProps {
  onClose: () => void;
}

// Shown after a request is sent. Closes on a click outside the card or on Escape.
function RequestSuccessDialog({ onClose }: RequestSuccessDialogProps) {
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
    <div className="request-dialog" data-testid="request-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="request-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <p id="request-dialog-title" className="request-dialog__title">
          Your request is live and waiting for a <strong>HITCHHIKER!</strong>
        </p>
        <img className="request-dialog__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
        <p className="request-dialog__hint">Click anywhere to close</p>
      </div>
    </div>
  );
}

export default RequestSuccessDialog;
