import { LiveSocket } from "./LiveSocket";

// A fake WebSocket for tests: the test opens, sends messages and closes it like the server would.
export class FakeSocket {
  static instances: FakeSocket[] = [];

  readyState = 0;
  closeCodes: number[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  close(code: number) {
    this.closeCodes.push(code);
  }

  serverOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  serverSend(message: unknown) {
    this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) });
  }

  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  static latest() {
    return FakeSocket.instances[FakeSocket.instances.length - 1];
  }

  static reset() {
    FakeSocket.instances = [];
  }
}

export function createFakeSocket(url: string) {
  return new FakeSocket(url) as unknown as WebSocket;
}

// A LiveSocket whose connection is already open, for pages under test. The test plays the
// server through FakeSocket.latest() (serverSend, serverClose, serverOpen).
export function openLiveSocket() {
  const live = new LiveSocket({
    url: "wss://localhost/ws/",
    createSocket: createFakeSocket,
    random: () => 1,
  });

  live.connect();
  FakeSocket.latest().serverOpen();

  return live;
}
