import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveContext } from "../../websocket/LiveProvider";
import { LiveSocket } from "../../websocket/LiveSocket";
import { createFakeSocket, FakeSocket } from "../../websocket/testSocket";
import ConnectionStatus, { BACK_ONLINE_MS } from "./ConnectionStatus";

function renderWithSocket() {
  const live = new LiveSocket({
    url: "wss://localhost/ws/",
    createSocket: createFakeSocket,
    random: () => 1,
  });

  render(
    <LiveContext.Provider value={live}>
      <ConnectionStatus />
    </LiveContext.Provider>,
  );

  return live;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.reset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ConnectionStatus", () => {
  it("shows nothing while connecting for the first time and once connected", () => {
    const live = renderWithSocket();

    act(() => live.connect());

    expect(screen.getByRole("status").textContent).toBe("");

    act(() => FakeSocket.latest().serverOpen());

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows Reconnecting… while the connection is lost", () => {
    const live = renderWithSocket();

    act(() => {
      live.connect();
      FakeSocket.latest().serverOpen();
      FakeSocket.latest().serverClose(1006);
    });

    expect(screen.getByRole("status").textContent).toBe("Reconnecting…");

    // Still lost while the next tries fail.
    act(() => {
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverClose(1006);
    });

    expect(screen.getByRole("status").textContent).toBe("Reconnecting…");
  });

  it("shows Back online for a moment once the connection returns", () => {
    const live = renderWithSocket();

    act(() => {
      live.connect();
      FakeSocket.latest().serverOpen();
      FakeSocket.latest().serverClose(1006);
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverOpen();
    });

    expect(screen.getByRole("status").textContent).toBe("Back online");

    act(() => vi.advanceTimersByTime(BACK_ONLINE_MS));

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows nothing after a logout or a lost session", () => {
    const live = renderWithSocket();

    act(() => {
      live.connect();
      FakeSocket.latest().serverOpen();
      FakeSocket.latest().serverClose(4401);
    });

    expect(screen.getByRole("status").textContent).toBe("");

    act(() => {
      live.connect();
      FakeSocket.latest().serverOpen();
      live.disconnect();
    });

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows nothing without a LiveProvider", () => {
    render(<ConnectionStatus />);

    expect(screen.getByRole("status").textContent).toBe("");
  });
});
