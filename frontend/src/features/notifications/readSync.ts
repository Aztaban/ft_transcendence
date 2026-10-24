import { useEffect } from "react";

// Marking notifications as read sends no WebSocket event (api-plan §9.3), so the tabs of this
// browser tell each other through a BroadcastChannel (#274). Other devices catch up on the next
// `notification.created`, a reconnect or a reload. One channel per tab; a tab does not hear its
// own messages. `null` in a browser without BroadcastChannel, and then nothing is shared.
const channel =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("notifications");

// Tells the other tabs that notifications were marked as read.
export function announceReadChange() {
  channel?.postMessage("read");
}

// Calls `onChange` when another tab marked notifications as read. Pass a stable function
// (useCallback), so the listener is not added again on every render.
export function useReadChanges(onChange: () => void) {
  useEffect(() => {
    if (!channel) {
      return;
    }

    const handleMessage = () => onChange();

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
    };
  }, [onChange]);
}
