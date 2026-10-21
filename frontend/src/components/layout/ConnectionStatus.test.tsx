import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveContext } from "../../websocket/LiveProvider";
import { LiveSocket } from "../../websocket/LiveSocket";
import { createFakeSocket, FakeSocket } from "../../websocket/testSocket";
import ConnectionStatus from "./ConnectionStatus";

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

function shown() {
  return screen.getByRole("status").textContent;
}

// Connects, loses the connection and gets it back after the 1 s backoff (random() = 1).
function connectLoseAndReturn(live: LiveSocket) {
  act(() => {
    live.connect();
    FakeSocket.latest().serverOpen();
  });
  act(() => FakeSocket.latest().serverClose(1006));
  act(() => {
    vi.advanceTimersByTime(1000);
    FakeSocket.latest().serverOpen();
  });
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

    expect(shown()).toBe("");

    act(() => FakeSocket.latest().serverOpen());

    expect(shown()).toBe("");
  });

  it("shows Reconnecting… with a reassurance for screen readers while the connection is lost", () => {
    const live = renderWithSocket();

    act(() => {
      live.connect();
      FakeSocket.latest().serverOpen();
    });
    act(() => FakeSocket.latest().serverClose(1006));

    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    expect(screen.getByText("Live updates are paused. The page keeps working.")).toBeTruthy();

    // Still lost while the next tries fail.
    act(() => {
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverClose(1006);
    });

    expect(screen.getByText("Reconnecting…")).toBeTruthy();
  });

  it("shows Back online for 2.5 s once the connection returns", () => {
    const live = renderWithSocket();

    connectLoseAndReturn(live);

    expect(shown()).toBe("Back online");

    act(() => vi.advanceTimersByTime(2499));

    expect(shown()).toBe("Back online");

    act(() => vi.advanceTimersByTime(1));

    expect(shown()).toBe("");
  });

  it("restarts the 2.5 s when the connection drops and returns again in the meantime", () => {
    const live = renderWithSocket();

    connectLoseAndReturn(live);
    act(() => vi.advanceTimersByTime(1000));

    // Lost again before "Back online" disappeared.
    act(() => FakeSocket.latest().serverClose(1006));

    expect(screen.getByText("Reconnecting…")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverOpen();
    });

    expect(shown()).toBe("Back online");

    // The full 2.5 s count from the second return.
    act(() => vi.advanceTimersByTime(2499));

    expect(shown()).toBe("Back online");

    act(() => vi.advanceTimersByTime(1));

    expect(shown()).toBe("");
  });

  it("does not show Back online when the first connection only succeeds after failed tries", () => {
    const live = renderWithSocket();

    act(() => live.connect());
    act(() => FakeSocket.latest().serverClose(1006));

    expect(screen.getByText("Reconnecting…")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverOpen();
    });

    expect(shown()).toBe("");
  });

  it("hides Back online at once on logout", () => {
    const live = renderWithSocket();

    connectLoseAndReturn(live);

    expect(shown()).toBe("Back online");

    act(() => live.disconnect());

    expect(shown()).toBe("");
  });

  it("hides Back online at once when the session is lost (4401)", () => {
    const live = renderWithSocket();

    connectLoseAndReturn(live);

    expect(shown()).toBe("Back online");

    act(() => FakeSocket.latest().serverClose(4401));

    expect(shown()).toBe("");
  });

  it("shows nothing without a LiveProvider", () => {
    render(<ConnectionStatus />);

    expect(shown()).toBe("");
  });
});
