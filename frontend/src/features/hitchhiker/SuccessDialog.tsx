import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import useDialog from "../../hooks/useDialog";

interface SuccessDialogProps {
  children: ReactNode;
  onClose: () => void;
}

// Confirmation popup from the Figma; closes on a click outside the card or on Escape.
function SuccessDialog({ children, onClose }: SuccessDialogProps) {
  const { t } = useTranslation();
  const cardRef = useDialog<HTMLDivElement>(onClose);

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
        <p className="success-dialog__hint">{t("common.clickToClose")}</p>
      </div>
    </div>
  );
}

export default SuccessDialog;
