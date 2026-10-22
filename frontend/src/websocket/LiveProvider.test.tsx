import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EVALUATION_EVENTS, type LiveMessage } from "./events";
import { LiveProvider, liveSocketUrl, useConnectionStatus, useLiveRefresh } from "./LiveProvider";
import { createFakeSocket, FakeSocket } from "./testSocket";

const session = vi.hoisted(() => ({
  isAuthenticated: true,
  isLoading: false,
  endSession: vi.fn(),
}));

vi.mock("../store/AuthContext", () => ({
  useAuth: () => ({
    user: session.isAuthenticated ? { id: 1, email: "a@42.cz", display_name: "dkolarov" } : null,
    isAuthenticated: session.isAuthenticated,
    isLoading: session.isLoading,
    login: vi.fn(),
    logout: vi.fn(),
    endSession: session.endSession,
  }),
}));

function Listener({ refetch }: { refetch: (message?: LiveMessage) => void }) {
  useLiveRefresh(EVALUATION_EVENTS, refetch);

  return <p>Status: {useConnectionStatus()}</p>;
}

function renderWithProvider(refetch = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LiveProvider createSocket={createFakeSocket}>
        <Routes>
          <Route path="/" element={<Listener refetch={refetch} />} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </LiveProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  FakeSocket.reset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  session.isAuthenticated = true;
  session.isLoading = false;
  session.endSession.mockReset();
});

describe("liveSocketUrl", () => {
  it("uses wss on https and ws otherwise", () => {
    expect(liveSocketUrl({ protocol: "https:", host: "localhost" })).toBe("wss://localhost/ws/");
    expect(liveSocketUrl({ protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173/ws/",
    );
  });
});

describe("LiveProvider", () => {
  it("connects once the user is logged in and shows the status", () => {
    renderWithProvider();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(screen.getByText("Status: connecting")).toBeTruthy();

    act(() => FakeSocket.latest().serverOpen());

    expect(screen.getByText("Status: open")).toBeTruthy();
  });

  it("does not connect while the session is loading or when logged out", () => {
    session.isLoading = true;
    renderWithProvider();
    cleanup();

    session.isLoading = false;
    session.isAuthenticated = false;
    renderWithProvider();

    expect(FakeSocket.instances).toHaveLength(0);
    expect(screen.getByText("Status: idle")).toBeTruthy();
  });

  it("closes the connection when the user logs out", () => {
    const { rerender } = renderWithProvider();

    act(() => FakeSocket.latest().serverOpen());
    session.isAuthenticated = false;
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <LiveProvider createSocket={createFakeSocket}>
          <Listener refetch={vi.fn()} />
        </LiveProvider>
      </MemoryRouter>,
    );

    expect(FakeSocket.latest().closeCodes).toEqual([1000]);
  });

  it("re-fetches on matching events only", () => {
    const refetch = vi.fn();

    renderWithProvider(refetch);
    act(() => {
      FakeSocket.latest().serverOpen();
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 3, status: "awaiting_confirmation" },
      });
      FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 9 } });
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    // The event tells which request changed.
    expect(refetch).toHaveBeenCalledWith({
      event: "evaluation.slot_picked",
      data: { id: 3, status: "awaiting_confirmation" },
    });
  });

  it("re-fetches after a reconnect", () => {
    vi.useFakeTimers();
    const refetch = vi.fn();

    renderWithProvider(refetch);
    act(() => {
      FakeSocket.latest().serverOpen();
      FakeSocket.latest().serverClose(1006);
    });

    expect(screen.getByText("Status: reconnecting")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    act(() => FakeSocket.latest().serverOpen());

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith();
    expect(screen.getByText("Status: open")).toBeTruthy();
  });

  it("logs out and goes to the login page on session.ended", () => {
    renderWithProvider();
    act(() => {
      FakeSocket.latest().serverOpen();
      FakeSocket.latest().serverSend({ event: "session.ended", data: {} });
    });

    expect(session.endSession).toHaveBeenCalled();
    expect(screen.getByText("Login page")).toBeTruthy();
  });

  it("logs out and goes to the login page on close code 4401", () => {
    renderWithProvider();
    act(() => FakeSocket.latest().serverClose(4401));

    expect(session.endSession).toHaveBeenCalled();
    expect(screen.getByText("Login page")).toBeTruthy();
  });
});

describe("hooks without a LiveProvider", () => {
  it("do nothing", () => {
    const refetch = vi.fn();

    render(<Listener refetch={refetch} />);

    expect(screen.getByText("Status: idle")).toBeTruthy();
    expect(refetch).not.toHaveBeenCalled();
  });
});
