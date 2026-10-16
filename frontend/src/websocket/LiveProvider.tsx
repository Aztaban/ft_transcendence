import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../store/AuthContext";
import type { LiveEventName } from "./events";
import { LiveSocket, type ConnectionStatus } from "./LiveSocket";

// Exported for tests, which provide their own LiveSocket.
export const LiveContext = createContext<LiveSocket | null>(null);

// §9.1: wss://<host>/ws/ (ws:// only when the page itself is not on https).
export function liveSocketUrl(location: Pick<Location, "protocol" | "host"> = window.location) {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/`;
}

interface LiveProviderProps {
  children: ReactNode;
  createSocket?: (url: string) => WebSocket;
}

// Opens the WebSocket once the session check says the user is logged in, and closes it on
// logout (§9.1). When the server ends the session (`session.ended` or close code 4401), the
// user is treated as logged out and sent to the login page.
export function LiveProvider({ children, createSocket }: LiveProviderProps) {
  const { isAuthenticated, isLoading, endSession } = useAuth();
  const navigate = useNavigate();
  const [socket] = useState(() => new LiveSocket({ url: liveSocketUrl(), createSocket }));

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [socket, isLoading, isAuthenticated]);

  useEffect(() => {
    function handleSessionEnded() {
      endSession();
      navigate("/login", { replace: true });
    }

    const unsubscribe = socket.subscribe((message) => {
      if (message.event === "session.ended") {
        handleSessionEnded();
      }
    });
    const stopUnauthorized = socket.onUnauthorized(handleSessionEnded);

    return () => {
      unsubscribe();
      stopUnauthorized();
    };
  }, [socket, endSession, navigate]);

  return <LiveContext.Provider value={socket}>{children}</LiveContext.Provider>;
}

// Calls `refetch` when one of `events` arrives, and after every reconnect, since missed events
// are not replayed (§9.2, §9.4). Pages re-fetch over REST and never build state from the event.
// Without a LiveProvider (e.g. in tests) it does nothing.
export function useLiveRefresh(events: readonly LiveEventName[], refetch: () => void) {
  const socket = useContext(LiveContext);
  const refetchRef = useRef(refetch);
  const eventsKey = events.join(",");

  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    if (!socket) {
      return;
    }

    const names = new Set(eventsKey.split(","));
    const unsubscribe = socket.subscribe((message) => {
      if (names.has(message.event)) {
        refetchRef.current();
      }
    });
    const stopReconnect = socket.onReconnect(() => refetchRef.current());

    return () => {
      unsubscribe();
      stopReconnect();
    };
  }, [socket, eventsKey]);
}

const noSubscription = () => () => {};

// The connection state, e.g. for a "Reconnecting…" indicator (§9.4).
export function useConnectionStatus(): ConnectionStatus {
  const socket = useContext(LiveContext);

  return useSyncExternalStore(
    socket ? (onChange) => socket.onStatusChange(onChange) : noSubscription,
    () => socket?.getStatus() ?? "idle",
  );
}
