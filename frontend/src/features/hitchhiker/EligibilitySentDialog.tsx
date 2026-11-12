import { Trans, useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import { Dialog } from "../../components/ui";

interface EligibilitySentDialogProps {
  onClose: () => void;
}

// Shown after the eligibility request is sent. Closes on a click outside the card or on Escape.
function EligibilitySentDialog({ onClose }: EligibilitySentDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      titleId="eligibility-dialog-title"
      onClose={onClose}
      backdropClassName="eligibility-dialog"
      className="eligibility-dialog__card"
      backdropTestId="eligibility-dialog-backdrop"
    >
      <p id="eligibility-dialog-title" className="eligibility-dialog__title">
        <Trans i18nKey="eligibility.sentTitle" components={{ strong: <strong /> }} />
      </p>
      <img className="eligibility-dialog__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
      <p className="eligibility-dialog__text">{t("eligibility.sentText")}</p>
      <p className="eligibility-dialog__hint">{t("common.clickToClose")}</p>
    </Dialog>
  );
}

export default EligibilitySentDialog;
