import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications";
import { useNotificationCount } from "../../store/NotificationCountContext";
import type { Notification } from "../../types/notification";
import { useLiveRefresh } from "../../websocket/LiveProvider";
import { notificationText } from "./notificationText";
import "../../styles/notifications.css";

// When a notification arrived, in the user's local time and the current language.
function formatCreatedAt(date: string, language: string) {
  return new Date(date).toLocaleString(language, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NotificationPanelProps {
  // Called when a notification's link is followed, so the panel closes.
  onClose: () => void;
}

// The notification center that opens from the bell in the top bar (#272). It loads the newest
// notifications every time it opens (GET /notifications/, api-plan §10.5) and again on the
// WebSocket events `notification.created` and `notification.updated` and after a reconnect (§9.3,
// §9.4). A notification with a `target_url` links to that page. Clicking an unread one marks it as
// read, and "Mark all as read" marks every one; other tabs and devices follow through
// `notification.updated` (#274).
function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Raised to load the list once more: on "Try again" and on live events.
  const [reloadKey, setReloadKey] = useState(0);
  // True while "Mark all as read" waits for the server, so it cannot be sent twice.
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const { unreadCount, refresh: refreshCount } = useNotificationCount();

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useLiveRefresh(["notification.created", "notification.updated"], refresh);

  useEffect(() => {
    // An older answer that arrives late must not overwrite a newer list.
    let active = true;

    listNotifications()
      .then((page) => {
        if (active) {
          setNotifications(page.results);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          // A failed live refresh keeps the list that is already shown.
          setStatus((current) => (current === "ready" ? current : "error"));
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function retry() {
    setStatus("loading");
    refresh();
  }

  // POST /notifications/{id}/read/ (§10.5): the answer replaces the item, and the badge on the bell
  // is loaded again. Already read ones need no request.
  function markRead(notification: Notification) {
    if (notification.read_at !== null) {
      return;
    }

    markNotificationRead(notification.id)
      .then((updated) => {
        setNotifications((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        refreshCount();
      })
      .catch(() => {
        // It stays unread; clicking it again tries once more.
      });
  }

  // POST /notifications/read-all/ (§10.5) answers 204 without a body, so the list is loaded again
  // instead of guessing the new `read_at` values.
  function markAllRead() {
    setIsMarkingAll(true);

    markAllNotificationsRead()
      .then(() => {
        refresh();
        refreshCount();
      })
      .catch(() => {
        // The list stays as it is; the button can be clicked again.
      })
      .finally(() => setIsMarkingAll(false));
  }

  // The badge counts every unread notification, but the list holds only the newest page (#674), so
  // older unread ones still need the button. The list covers the moment before the count arrives.
  const hasUnread = unreadCount > 0 || notifications.some((item) => item.read_at === null);

  return (
    <section
      id="notification-panel"
      className="notification-panel"
      aria-label={t("notificationPanel.title")}
    >
      <div className="notification-panel__header">
        <h2 className="notification-panel__title">{t("notificationPanel.title")}</h2>
        {hasUnread && (
          <button
            className="notification-panel__mark-all"
            type="button"
            disabled={isMarkingAll}
            onClick={markAllRead}
          >
            {t("notificationPanel.markAllRead")}
          </button>
        )}
      </div>

      {status === "loading" && (
        <p className="notification-panel__message">{t("notificationPanel.loading")}</p>
      )}

      {status === "error" && (
        <>
          <p className="notification-panel__message" role="alert">
            {t("notificationPanel.error")}
          </p>
          <button className="notification-panel__retry" type="button" onClick={retry}>
            {t("notificationPanel.retry")}
          </button>
        </>
      )}

      {status === "ready" && notifications.length === 0 && (
        <p className="notification-panel__message">{t("notificationPanel.empty")}</p>
      )}

      {status === "ready" && notifications.length > 0 && (
        <ul className="notification-panel__list">
          {notifications.map((notification) => {
            const isUnread = notification.read_at === null;
            const content = (
              <>
                {isUnread && (
                  <span className="notification-panel__sr-only">
                    {t("notificationPanel.unread")}
                  </span>
                )}
                <span className="notification-panel__text">{notificationText(notification)}</span>
                <time className="notification-panel__time" dateTime={notification.created_at}>
                  {formatCreatedAt(notification.created_at, i18n.language)}
                </time>
              </>
            );

            return (
              <li
                key={notification.id}
                className={[
                  "notification-panel__item",
                  isUnread ? "notification-panel__item--unread" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {notification.target_url ? (
                  <Link
                    className="notification-panel__entry"
                    to={notification.target_url}
                    onClick={() => {
                      markRead(notification);
                      onClose();
                    }}
                  >
                    {content}
                  </Link>
                ) : isUnread ? (
                  <button
                    className="notification-panel__entry"
                    type="button"
                    onClick={() => markRead(notification)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="notification-panel__entry">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default NotificationPanel;
