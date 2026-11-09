import { useTranslation } from "react-i18next";

import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import { Dialog } from "../../components/ui";

interface MarkedReadDialogProps {
  onClose: () => void;
}

// Figma "marks as read". Closes on a click outside the card or on Escape.
function MarkedReadDialog({ onClose }: MarkedReadDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      titleId="marked-read-title"
      onClose={onClose}
      backdropClassName="message-sent"
      className="message-sent__card marked-read__card"
      backdropTestId="marked-read-backdrop"
    >
      <p id="marked-read-title" className="marked-read__title">
        {t("council.markedReadTitle")}
      </p>
      <img className="marked-read__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
      <p className="message-sent__hint">{t("council.clickToClose")}</p>
    </Dialog>
  );
}

export default MarkedReadDialog;
