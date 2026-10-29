import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { getUnreadCount } from "../api/notifications";
import { useLiveRefresh } from "../websocket/LiveProvider";
import { useAuth } from "./AuthContext";

interface NotificationCountValue {
  // Unread notifications of the logged-in user (GET /notifications/unread-count/, api-plan §10.5).
  unreadCount: number;
  // Loads the count again, e.g. right after this tab marked notifications as read (#274), without
  // waiting for the `notification.updated` event.
  refresh: () => void;
}

const NotificationCountContext = createContext<NotificationCountValue | undefined>(undefined);

interface NotificationCountProviderProps {
  children: ReactNode;
}

// The unread count for the bell badge, kept in one place so every component shows the
// same number. It starts at 0: no badge until the server has answered. Loaded only once the
// session check says the user is logged in, re-fetched on the WebSocket events
// `notification.created` and `notification.updated` and after every reconnect (api-plan §9.3,
// §9.4); back to 0 on logout.
export function NotificationCountProvider({ children }: NotificationCountProviderProps) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useLiveRefresh(["notification.created", "notification.updated"], refresh);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    // An older answer that arrives late must not overwrite a newer count.
    let active = true;

    getUnreadCount()
      .then((result) => {
        if (active) {
          setUnreadCount(result.count);
        }
      })
      .catch(() => {
        // Keep the last count; the next event or reconnect tries again.
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, reloadKey]);

  return (
    <NotificationCountContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationCountContext.Provider>
  );
}

const noNotificationCount: NotificationCountValue = { unreadCount: 0, refresh: () => {} };

// Without a provider (e.g. in component tests) the count is 0, so no badge is shown.
export function useNotificationCount(): NotificationCountValue {
  return useContext(NotificationCountContext) ?? noNotificationCount;
}
