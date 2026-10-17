import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser } from "../api/users";
import type { UserProfile } from "../types/user";
import { LiveContext } from "../websocket/LiveProvider";
import { LiveSocket } from "../websocket/LiveSocket";
import { createFakeSocket, FakeSocket } from "../websocket/testSocket";
import { CurrentUserProvider, useCurrentUser } from "./CurrentUserContext";

vi.mock("../api/users", () => ({ getCurrentUser: vi.fn() }));

const session = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: session.isAuthenticated }),
}));

function me(roles: UserProfile["roles"]): UserProfile {
  return { id: 2, email: "dkolarov@42.cz", display_name: "dkolarov", language: "en", roles };
}

function Probe() {
  const { roles, isLoaded } = useCurrentUser();

  return <p>{isLoaded ? `roles: ${roles.join(",")}` : "not loaded"}</p>;
}

function renderWithSocket() {
  const live = new LiveSocket({
    url: "wss://localhost/ws/",
    createSocket: createFakeSocket,
    random: () => 1,
  });

  live.connect();
  FakeSocket.latest().serverOpen();

  return render(
    <LiveContext.Provider value={live}>
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>
    </LiveContext.Provider>,
  );
}

beforeEach(() => {
  FakeSocket.reset();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  session.isAuthenticated = true;
});

describe("CurrentUserProvider", () => {
  it("loads the user's roles once logged in, with string or object roles", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(me(["student", { id: 2, name: "tutor" }]));

    renderWithSocket();

    expect(await screen.findByText("roles: student,tutor")).toBeTruthy();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("does not call /users/me/ when nobody is logged in", () => {
    session.isAuthenticated = false;

    renderWithSocket();

    expect(screen.getByText("not loaded")).toBeTruthy();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("re-fetches the roles on role.changed", async () => {
    vi.mocked(getCurrentUser)
      .mockResolvedValueOnce(me(["student"]))
      .mockResolvedValueOnce(me(["student", "tutor"]));

    renderWithSocket();
    await screen.findByText("roles: student");

    act(() => FakeSocket.latest().serverSend({ event: "role.changed", data: {} }));

    expect(await screen.findByText("roles: student,tutor")).toBeTruthy();
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it("forgets the user on logout", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(me(["student"]));

    const view = renderWithSocket();
    await screen.findByText("roles: student");

    session.isAuthenticated = false;
    view.rerender(
      <LiveContext.Provider value={null}>
        <CurrentUserProvider>
          <Probe />
        </CurrentUserProvider>
      </LiveContext.Provider>,
    );

    await waitFor(() => expect(screen.getByText("not loaded")).toBeTruthy());
  });
});
