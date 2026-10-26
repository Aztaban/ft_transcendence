import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConnectionStatus, useLiveRefresh } from "../../websocket/LiveProvider";
import "../../styles/connection-status.css";

// How long "Back online" stays after the connection returns.
export const BACK_ONLINE_MS = 2500;

// The small "Reconnecting…" indicator of api-plan §9.4: shown while the WebSocket is lost; the
// app keeps working over HTTP meanwhile. Nothing is shown while connecting for the first time or
// after a logout, so it doesn't flash on every page load (#253).
function ConnectionStatus() {
  const { t } = useTranslation();
  const status = useConnectionStatus();
  const hasBeenOnline = useRef(false);
  // A timestamp rather than a boolean, so every reconnect restarts the "Back online" timer.
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);

  // With no events, useLiveRefresh only fires when the connection is back after a loss. If the
  // very first attempts failed, we were never online, so there is nothing to be "back" to.
  useLiveRefresh([], () => {
    if (hasBeenOnline.current) {
      setReconnectedAt(Date.now());
    }
  });

  useEffect(() => {
    if (status === "open") {
      hasBeenOnline.current = true;
    } else if (status === "closed" || status === "idle") {
      hasBeenOnline.current = false;
      setReconnectedAt(null);
    }
  }, [status]);

  useEffect(() => {
    if (reconnectedAt === null) {
      return;
    }

    const timer = setTimeout(() => setReconnectedAt(null), BACK_ONLINE_MS);

    return () => clearTimeout(timer);
  }, [reconnectedAt]);

  // The live region stays in the page, so screen readers announce the changes.
  return (
    <div className="connection-status" role="status" aria-live="polite">
      {status === "reconnecting" && (
        <span
          className="connection-status__pill connection-status__pill--lost"
          title={t("connection.paused")}
        >
          <span className="connection-status__spinner" aria-hidden="true" />
          <span className="connection-status__label">{t("connection.reconnecting")}</span>
          <span className="connection-status__sr-only">{t("connection.paused")}</span>
        </span>
      )}

      {status === "open" && reconnectedAt !== null && (
        <span className="connection-status__pill connection-status__pill--back">
          <span className="connection-status__dot" aria-hidden="true" />
          <span className="connection-status__label">{t("connection.backOnline")}</span>
        </span>
      )}
    </div>
  );
}

export default ConnectionStatus;
