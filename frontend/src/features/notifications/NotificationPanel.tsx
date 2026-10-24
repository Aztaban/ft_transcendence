import { useTranslation } from "react-i18next";

import "../../styles/notifications.css";

// The notification center that opens from the bell in the top bar (#272).
function NotificationPanel() {
  const { t } = useTranslation();

  return (
    <section
      id="notification-panel"
      className="notification-panel"
      aria-label={t("notificationPanel.title")}
    >
      <h2 className="notification-panel__title">{t("notificationPanel.title")}</h2>
    </section>
  );
}

export default NotificationPanel;
