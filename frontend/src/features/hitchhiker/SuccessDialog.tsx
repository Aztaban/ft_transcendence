import { useEffect, useRef, type ReactNode } from "react";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";

interface SuccessDialogProps {
  children: ReactNode;
  onClose: () => void;
}

// Confirmation popup from the Figma; closes on a click outside the card or on Escape.
function SuccessDialog({ children, onClose }: SuccessDialogProps) {
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
    <div className="success-dialog" data-testid="success-dialog-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="success-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <p id="success-dialog-title" className="success-dialog__title">
          {children}
        </p>
        <img className="success-dialog__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
        <p className="success-dialog__hint">Click anywhere to close</p>
      </div>
    </div>
  );
}

export default SuccessDialog;
