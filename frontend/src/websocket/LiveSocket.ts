import { parseLiveMessage, type LiveMessage } from "./events";

// "idle" before the first connect, "closed" after a logout or a 4401.
export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

// §9.1: a connection without a valid session is closed with 4401; the user is logged out.
export const UNAUTHORIZED_CLOSE_CODE = 4401;

const NORMAL_CLOSE_CODE = 1000;
const SOCKET_CONNECTING = 0;
const FIRST_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

// §9.4: reconnect with backoff 1 s, 2 s, 4 s, … up to 30 s, with jitter. The jitter keeps
// between half and all of the delay, so many tabs don't reconnect at the same moment.
export function reconnectDelay(attempt: number, random: () => number = Math.random) {
  const delay = Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** attempt);

  return Math.round(delay / 2 + (random() * delay) / 2);
}

interface LiveSocketOptions {
  url: string;
  createSocket?: (url: string) => WebSocket;
  random?: () => number;
}

type Listener<T> = (value: T) => void;

function addListener<T>(listeners: Set<T>, listener: T) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// The app's single WebSocket connection (one per browser tab, §9.1). The server pushes events;
// the client never sends anything.
export class LiveSocket {
  private readonly url: string;
  private readonly createSocket: (url: string) => WebSocket;
  private readonly random: () => number;

  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: ConnectionStatus = "idle";
  private attempt = 0;
  private stopped = true;
  // True after a connection was lost: the next open must re-fetch everything (§9.4).
  private needsResync = false;

  private readonly messageListeners = new Set<Listener<LiveMessage>>();
  private readonly statusListeners = new Set<Listener<ConnectionStatus>>();
  private readonly reconnectListeners = new Set<() => void>();
  private readonly unauthorizedListeners = new Set<() => void>();

  constructor({
    url,
    createSocket = (target) => new WebSocket(target),
    random,
  }: LiveSocketOptions) {
    this.url = url;
    this.createSocket = createSocket;
    this.random = random ?? Math.random;
  }

  getStatus() {
    return this.status;
  }

  // Opens the connection, unless it is already open or waiting to reconnect.
  connect() {
    this.stopped = false;

    if (this.socket || this.timer) {
      return;
    }

    this.open();
  }

  // Closes the connection for good, e.g. on logout. No reconnect afterwards.
  disconnect() {
    this.stopped = true;
    this.clearTimer();
    this.attempt = 0;
    this.needsResync = false;

    const socket = this.socket;

    this.socket = null;

    if (socket) {
      socket.onmessage = null;
      socket.onclose = null;

      if (socket.readyState === SOCKET_CONNECTING) {
        // Closing a socket that is still connecting makes the browser log a warning, so it is
        // closed as soon as it opens instead.
        socket.onopen = () => socket.close(NORMAL_CLOSE_CODE);
      } else {
        socket.onopen = null;
        socket.close(NORMAL_CLOSE_CODE);
      }
    }

    this.setStatus("closed");
  }

  subscribe(listener: Listener<LiveMessage>) {
    return addListener(this.messageListeners, listener);
  }

  onStatusChange(listener: Listener<ConnectionStatus>) {
    return addListener(this.statusListeners, listener);
  }

  // Called when the connection is back after a loss: events in between were not replayed.
  onReconnect(listener: () => void) {
    return addListener(this.reconnectListeners, listener);
  }

  // Called on close code 4401: the session is gone.
  onUnauthorized(listener: () => void) {
    return addListener(this.unauthorizedListeners, listener);
  }

  private open() {
    this.timer = null;
    this.setStatus(this.needsResync ? "reconnecting" : "connecting");

    const socket = this.createSocket(this.url);

    this.socket = socket;
    socket.onopen = () => this.handleOpen();
    socket.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    socket.onclose = (event: CloseEvent) => this.handleClose(socket, event.code);
  }

  private handleOpen() {
    const isResync = this.needsResync;

    this.attempt = 0;
    this.needsResync = false;
    this.setStatus("open");

    if (isResync) {
      this.reconnectListeners.forEach((listener) => listener());
    }
  }

  private handleMessage(raw: unknown) {
    const message = parseLiveMessage(raw);

    if (!message) {
      return;
    }

    if (message.event === "session.ended") {
      // The server closes the connection with 4401 right after (§9.3); don't reconnect.
      this.stopped = true;
    }

    this.messageListeners.forEach((listener) => listener(message));
  }

  private handleClose(socket: WebSocket, code: number) {
    if (socket !== this.socket) {
      return;
    }

    this.socket = null;

    if (code === UNAUTHORIZED_CLOSE_CODE) {
      this.stopped = true;
      this.setStatus("closed");
      this.unauthorizedListeners.forEach((listener) => listener());

      return;
    }

    if (this.stopped) {
      this.setStatus("closed");

      return;
    }

    const delay = reconnectDelay(this.attempt, this.random);

    this.attempt += 1;
    this.needsResync = true;
    this.setStatus("reconnecting");
    this.timer = setTimeout(() => this.open(), delay);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (status !== this.status) {
      this.status = status;
      this.statusListeners.forEach((listener) => listener(status));
    }
  }
}
