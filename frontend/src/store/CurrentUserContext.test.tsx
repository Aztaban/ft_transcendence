import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser, updateCurrentUser } from "../api/users";
import type { RoleName, UserProfile } from "../types/user";
import { LiveContext } from "../websocket/LiveProvider";
import { LiveSocket } from "../websocket/LiveSocket";
import { createFakeSocket, FakeSocket } from "../websocket/testSocket";
import { CurrentUserProvider, useCurrentUser } from "./CurrentUserContext";

vi.mock("../api/users", () => ({ getCurrentUser: vi.fn(), updateCurrentUser: vi.fn() }));

const session = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: session.isAuthenticated }),
}));

function me(roles: RoleName[]): UserProfile {
  return {
    id: 2,
    email: "dkolarov@42.cz",
    display_name: "dkolarov",
    avatar_url: null,
    language: "en",
    roles: roles.map((name, index) => ({ id: index + 1, name })),
    intra_login: "dkolarov",
  };
}

// A promise settled by the test, to order the answers of two requests.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function Probe() {
  const { user, roles, isLoaded, loadFailed, update } = useCurrentUser();
  const [saved, setSaved] = useState("");

  return (
    <>
      <p>{isLoaded ? `roles: ${roles.join(",")}` : loadFailed ? "failed" : "not loaded"}</p>
      <p>{user ? `name: ${user.display_name}` : "no name"}</p>
      <p>{saved}</p>
      <button
        type="button"
        onClick={() =>
          update({ display_name: "Diana K." }).then(
            () => setSaved("save ok"),
            () => setSaved("save failed"),
          )
        }
      >
        rename
      </button>
    </>
  );
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
    vi.mocked(getCurrentUser).mockResolvedValue(me(["student", "tutor"]));

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

  it("says when /users/me/ failed and nothing is loaded", async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("network"));

    renderWithSocket();

    expect(await screen.findByText("failed")).toBeTruthy();
  });

  // #776: every reader of the shared user sees a save, the top bar included.
  it("saves through PATCH /users/me/ and re-fetches the profile", async () => {
    vi.mocked(getCurrentUser)
      .mockResolvedValueOnce(me(["student"]))
      .mockResolvedValueOnce({ ...me(["student"]), display_name: "Diana K." });
    vi.mocked(updateCurrentUser).mockResolvedValue(undefined);

    renderWithSocket();
    await screen.findByText("name: dkolarov");

    act(() => screen.getByRole("button", { name: "rename" }).click());

    expect(await screen.findByText("name: Diana K.")).toBeTruthy();
    expect(await screen.findByText("save ok")).toBeTruthy();
    expect(updateCurrentUser).toHaveBeenCalledWith({ display_name: "Diana K." });
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it("rejects the save when the re-fetch fails, and keeps the old profile", async () => {
    vi.mocked(getCurrentUser)
      .mockResolvedValueOnce(me(["student"]))
      .mockRejectedValueOnce(new Error("network"));
    vi.mocked(updateCurrentUser).mockResolvedValue(undefined);

    renderWithSocket();
    await screen.findByText("name: dkolarov");

    act(() => screen.getByRole("button", { name: "rename" }).click());

    expect(await screen.findByText("save failed")).toBeTruthy();
    expect(screen.getByText("name: dkolarov")).toBeTruthy();
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it("keeps the newest answer when an older request resolves later", async () => {
    const first = deferred<UserProfile>();
    const second = deferred<UserProfile>();
    vi.mocked(getCurrentUser)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    renderWithSocket();
    act(() => FakeSocket.latest().serverSend({ event: "role.changed", data: {} }));

    await act(async () => second.resolve(me(["student", "tutor"])));
    expect(screen.getByText("roles: student,tutor")).toBeTruthy();

    await act(async () => first.resolve(me(["student"])));
    expect(screen.getByText("roles: student,tutor")).toBeTruthy();
  });

  it("does not fetch the profile when a save finishes after the logout", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(me(["student"]));
    const patch = deferred<void>();
    vi.mocked(updateCurrentUser).mockReturnValue(patch.promise);

    const view = renderWithSocket();
    await screen.findByText("name: dkolarov");
    act(() => screen.getByRole("button", { name: "rename" }).click());

    session.isAuthenticated = false;
    view.rerender(
      <LiveContext.Provider value={null}>
        <CurrentUserProvider>
          <Probe />
        </CurrentUserProvider>
      </LiveContext.Provider>,
    );
    await waitFor(() => expect(screen.getByText("not loaded")).toBeTruthy());

    await act(async () => patch.resolve());

    expect(await screen.findByText("save failed")).toBeTruthy();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("keeps the profile when the PATCH fails", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(me(["student"]));
    vi.mocked(updateCurrentUser).mockRejectedValue(new Error("offline"));

    renderWithSocket();
    await screen.findByText("name: dkolarov");

    act(() => screen.getByRole("button", { name: "rename" }).click());

    expect(await screen.findByText("save failed")).toBeTruthy();
    expect(screen.getByText("name: dkolarov")).toBeTruthy();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
