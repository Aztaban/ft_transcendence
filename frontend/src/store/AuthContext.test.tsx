import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthContext";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function SessionProbe() {
  const { user, isLoading, logout } = useAuth();
  if (isLoading) return <p>Loading</p>;
  return (
    <>
      <p>{user ? user.display_name : "Logged out"}</p>
      {user && <button onClick={() => void logout()}>Log out</button>}
    </>
  );
}

test("finishes loading an anonymous session without an error", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ authenticated: false, user: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  render(
    <AuthProvider>
      <SessionProbe />
    </AuthProvider>,
  );

  expect(await screen.findByText("Logged out")).toBeDefined();
  expect(screen.queryByText("Loading")).toBeNull();
  expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("restores an OAuth session after remount and clears it after logout", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  for (let i = 0; i < 2; i++) {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 42, email: "oauth@example.com", display_name: "OAuth User" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }
  fetchMock.mockImplementationOnce(async () => {
    document.cookie = "csrftoken=logout-csrf; path=/";
    return new Response(JSON.stringify({ status: "ok", version: "v1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

  const first = render(
    <AuthProvider>
      <SessionProbe />
    </AuthProvider>,
  );
  expect(await screen.findByText("OAuth User")).toBeDefined();
  first.unmount();
  render(
    <AuthProvider>
      <SessionProbe />
    </AuthProvider>,
  );
  expect(await screen.findByText("OAuth User")).toBeDefined();
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/v1/auth/session/",
    expect.objectContaining({ credentials: "same-origin" }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(screen.getByText("Logged out")).toBeDefined());
  const [url, options] = fetchMock.mock.calls[3];
  expect(url).toBe("/api/v1/auth/logout/");
  expect(options?.method).toBe("POST");
  expect(options?.credentials).toBe("same-origin");
  expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("logout-csrf");
});
