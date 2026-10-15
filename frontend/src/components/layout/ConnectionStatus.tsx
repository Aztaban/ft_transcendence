import { useEffect, useState } from "react";

import { useConnectionStatus, useLiveRefresh } from "../../websocket/LiveProvider";
import "../../styles/connection-status.css";

// How long "Back online" stays after the connection returns.
export const BACK_ONLINE_MS = 2500;

// The small "Reconnecting…" indicator of api-plan §9.4: shown while the WebSocket is lost; the
// app keeps working over HTTP meanwhile. Nothing is shown on the first connection or after a
// logout, so it doesn't flash on every page load (#253).
function ConnectionStatus() {
  const status = useConnectionStatus();
  const [isBackOnline, setIsBackOnline] = useState(false);

  // With no events, useLiveRefresh only fires when the connection is back after a loss.
  useLiveRefresh([], () => setIsBackOnline(true));

  useEffect(() => {
    if (!isBackOnline) {
      return;
    }

    const timer = setTimeout(() => setIsBackOnline(false), BACK_ONLINE_MS);

    return () => clearTimeout(timer);
  }, [isBackOnline]);

  // The live region stays in the page, so screen readers announce the changes.
  return (
    <div className="connection-status" role="status" aria-live="polite">
      {status === "reconnecting" && (
        <span
          className="connection-status__pill connection-status__pill--lost"
          title="Live updates are paused. The page keeps working."
        >
          <span className="connection-status__spinner" aria-hidden="true" />
          Reconnecting…
        </span>
      )}

      {status === "open" && isBackOnline && (
        <span className="connection-status__pill connection-status__pill--back">
          <span className="connection-status__dot" aria-hidden="true" />
          Back online
        </span>
      )}
    </div>
  );
}

export default ConnectionStatus;
