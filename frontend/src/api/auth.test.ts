import { afterEach, describe, expect, test, vi } from "vitest";

import { getSession, loginUser, logoutUser } from "./auth";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

describe("loginUser", () => {
  test("gets a CSRF cookie before submitting login credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return new Response(
        JSON.stringify({
          status: "ok",
          version: "v1",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 1,
          email: "login@example.com",
          display_name: "test-login",
          message: "Logged in successfully.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await loginUser({
      email: "login@example.com",
      password: "TestLoginPassword123!",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/",
      expect.objectContaining({
        credentials: "same-origin",
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/login/",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.any(Headers),
        body: JSON.stringify({
          email: "login@example.com",
          password: "TestLoginPassword123!",
        }),
      }),
    );

    const loginRequest = fetchMock.mock.calls[1][1] as RequestInit;
    const headers = loginRequest.headers as Headers;

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");

    expect(response).toEqual({
      id: 1,
      email: "login@example.com",
      display_name: "test-login",
      message: "Logged in successfully.",
    });
  });
});

describe("getSession", () => {
  test("returns an anonymous session as a successful response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false, user: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await getSession()).toEqual({ authenticated: false, user: null });
  });

  test("restores the authenticated user from the session endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: {
            id: 1,
            email: "login@example.com",
            display_name: "test-login",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const session = await getSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/session/",
      expect.objectContaining({
        credentials: "same-origin",
      }),
    );

    expect(session).toEqual({
      authenticated: true,
      user: {
        id: 1,
        email: "login@example.com",
        display_name: "test-login",
      },
    });
  });
});

describe("logoutUser", () => {
  test("gets a CSRF cookie and logs out the current session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return new Response(JSON.stringify({ status: "ok", version: "v1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await logoutUser();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/",
      expect.objectContaining({
        credentials: "same-origin",
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/logout/",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.any(Headers),
      }),
    );

    const logoutRequest = fetchMock.mock.calls[1][1] as RequestInit;
    const headers = logoutRequest.headers as Headers;

    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
  });
});
