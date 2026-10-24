import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listNotifications } from "../../api/notifications";
import type { Notification } from "../../types/notification";
import "../../styles/notifications.css";

// The notification center that opens from the bell in the top bar (#272). It loads the newest
// notifications every time it opens (GET /notifications/, api-plan §10.5).
function NotificationPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Raised by "Try again" to load the list once more.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // An older answer that arrives late must not overwrite a newer list.
    let active = true;

    setStatus("loading");

    listNotifications()
      .then((page) => {
        if (active) {
          setNotifications(page.results);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <section
      id="notification-panel"
      className="notification-panel"
      aria-label={t("notificationPanel.title")}
    >
      <h2 className="notification-panel__title">{t("notificationPanel.title")}</h2>

      {status === "loading" && (
        <p className="notification-panel__message">{t("notificationPanel.loading")}</p>
      )}

      {status === "error" && (
        <>
          <p className="notification-panel__message" role="alert">
            {t("notificationPanel.error")}
          </p>
          <button
            className="notification-panel__retry"
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            {t("notificationPanel.retry")}
          </button>
        </>
      )}

      {status === "ready" && notifications.length === 0 && (
        <p className="notification-panel__message">{t("notificationPanel.empty")}</p>
      )}
    </section>
  );
}

export default NotificationPanel;
