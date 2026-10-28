import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface MessageSentDialogProps {
  onClose: () => void;
}

// Figma "Message Sent". Closes on a click outside the card or on Escape.
function MessageSentDialog({ onClose }: MessageSentDialogProps) {
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
    <div className="message-sent" data-testid="message-sent-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="message-sent__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-sent-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
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
      </div>
    </div>
  );
}

export default MessageSentDialog;
