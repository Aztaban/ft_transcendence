import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import { Dialog } from "../../components/ui";

interface SuccessDialogProps {
  children: ReactNode;
  onClose: () => void;
}

// Confirmation popup from the Figma; closes on a click outside the card or on Escape.
function SuccessDialog({ children, onClose }: SuccessDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      titleId="success-dialog-title"
      onClose={onClose}
      backdropClassName="success-dialog"
      className="success-dialog__card"
      backdropTestId="success-dialog-backdrop"
    >
      <p id="success-dialog-title" className="success-dialog__title">
        {children}
      </p>
      <img className="success-dialog__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
      <p className="success-dialog__hint">{t("common.clickToClose")}</p>
    </Dialog>
  );
}

export default SuccessDialog;
