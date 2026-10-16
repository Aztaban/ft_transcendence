import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveSocket, reconnectDelay } from "./LiveSocket";
import { createFakeSocket, FakeSocket } from "./testSocket";

function makeSocket() {
  return new LiveSocket({
    url: "wss://localhost/ws/",
    createSocket: createFakeSocket,
    random: () => 1,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reconnectDelay", () => {
  it("doubles from 1 s up to 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((attempt) => reconnectDelay(attempt, () => 1))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });

  it("adds jitter, keeping at least half of the delay", () => {
    expect(reconnectDelay(2, () => 0)).toBe(2000);
    expect(reconnectDelay(2, () => 0.5)).toBe(3000);
  });
});

describe("LiveSocket", () => {
  it("opens one connection to the URL and reports its status", () => {
    const live = makeSocket();
    const statuses: string[] = [];

    live.onStatusChange((status) => statuses.push(status));
    live.connect();
    live.connect();
    FakeSocket.latest().serverOpen();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.latest().url).toBe("wss://localhost/ws/");
    expect(statuses).toEqual(["connecting", "open"]);
  });

  it("passes known events to subscribers and ignores anything else", () => {
    const live = makeSocket();
    const received = vi.fn();

    live.subscribe(received);
    live.connect();
    FakeSocket.latest().serverOpen();
    FakeSocket.latest().serverSend({
      event: "evaluation.confirmed",
      data: { id: 17, status: "confirmed" },
    });
    FakeSocket.latest().serverSend("not json");
    FakeSocket.latest().serverSend({ event: "something.else", data: {} });
    FakeSocket.latest().serverSend({ event: "evaluation.confirmed" });

    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith({
      event: "evaluation.confirmed",
      data: { id: 17, status: "confirmed" },
    });
  });

  it("reconnects with backoff after a lost connection and asks to re-fetch", () => {
    const live = makeSocket();
    const resync = vi.fn();

    live.onReconnect(resync);
    live.connect();
    FakeSocket.latest().serverOpen();

    FakeSocket.latest().serverClose(1006);
    expect(live.getStatus()).toBe("reconnecting");

    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    // The second try fails too: the next one waits 2 s.
    FakeSocket.latest().serverClose(1006);
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);

    expect(resync).not.toHaveBeenCalled();
    FakeSocket.latest().serverOpen();

    expect(live.getStatus()).toBe("open");
    expect(resync).toHaveBeenCalledTimes(1);

    // After a successful open the backoff starts again from 1 s.
    FakeSocket.latest().serverClose(1006);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(4);
  });

  it("does not ask to re-fetch on the first open", () => {
    const live = makeSocket();
    const resync = vi.fn();

    live.onReconnect(resync);
    live.connect();
    FakeSocket.latest().serverOpen();

    expect(resync).not.toHaveBeenCalled();
  });

  it("stops on close code 4401 and reports the lost session", () => {
    const live = makeSocket();
    const unauthorized = vi.fn();

    live.onUnauthorized(unauthorized);
    live.connect();
    FakeSocket.latest().serverClose(4401);
    vi.advanceTimersByTime(60_000);

    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(live.getStatus()).toBe("closed");
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("does not reconnect after session.ended", () => {
    const live = makeSocket();
    const received = vi.fn();

    live.subscribe(received);
    live.connect();
    FakeSocket.latest().serverOpen();
    FakeSocket.latest().serverSend({ event: "session.ended", data: {} });
    FakeSocket.latest().serverClose(1006);
    vi.advanceTimersByTime(60_000);

    expect(received).toHaveBeenCalledWith({ event: "session.ended", data: {} });
    expect(FakeSocket.instances).toHaveLength(1);
    expect(live.getStatus()).toBe("closed");
  });

  it("closes for good on disconnect, also while waiting to reconnect", () => {
    const live = makeSocket();

    live.connect();
    FakeSocket.latest().serverOpen();
    live.disconnect();

    expect(FakeSocket.latest().closeCodes).toEqual([1000]);
    expect(live.getStatus()).toBe("closed");

    live.connect();
    FakeSocket.latest().serverOpen();
    FakeSocket.latest().serverClose(1006);
    live.disconnect();
    vi.advanceTimersByTime(60_000);

    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("waits for a connecting socket to open before closing it", () => {
    const live = makeSocket();

    live.connect();
    live.disconnect();

    expect(FakeSocket.latest().closeCodes).toEqual([]);

    FakeSocket.latest().serverOpen();

    expect(FakeSocket.latest().closeCodes).toEqual([1000]);
  });
});
