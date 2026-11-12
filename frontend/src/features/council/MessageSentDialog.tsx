import { useTranslation } from "react-i18next";

import { Dialog } from "../../components/ui";

interface MessageSentDialogProps {
  onClose: () => void;
}

// Figma "Message Sent". Closes on a click outside the card or on Escape.
function MessageSentDialog({ onClose }: MessageSentDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      titleId="message-sent-title"
      onClose={onClose}
      backdropClassName="message-sent"
      className="message-sent__card"
      backdropTestId="message-sent-backdrop"
    >
      <svg className="message-sent__check" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="23" />
        <path d="m15 27 7.5 7.5L37 19.5" />
      </svg>
      <h2 id="message-sent-title" className="message-sent__title">
        {t("council.sentTitle")}
      </h2>
      <p>{t("council.sentDelivered")}</p>
      <p>{t("council.sentNoReply")}</p>
      <p className="message-sent__hint">{t("council.clickToClose")}</p>
    </Dialog>
  );
}

export default MessageSentDialog;
