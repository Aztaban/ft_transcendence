import { Trans, useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import { Dialog } from "../../components/ui";

interface RequestSuccessDialogProps {
  onClose: () => void;
}

// Shown after a request is sent. Closes on a click outside the card or on Escape.
function RequestSuccessDialog({ onClose }: RequestSuccessDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      titleId="request-dialog-title"
      onClose={onClose}
      backdropClassName="request-dialog"
      className="request-dialog__card"
      backdropTestId="request-dialog-backdrop"
    >
      <p id="request-dialog-title" className="request-dialog__title">
        <Trans i18nKey="createRequest.success" components={{ strong: <strong /> }} />
      </p>
      <img className="request-dialog__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
      <p className="request-dialog__hint">{t("common.clickToClose")}</p>
    </Dialog>
  );
}

export default RequestSuccessDialog;
