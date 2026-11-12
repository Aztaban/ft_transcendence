import { afterEach, describe, expect, test, vi } from "vitest";

import i18n from "../i18n";
import { getSession, loginUser, logoutUser, registerUser } from "./auth";
import { ApiError } from "./client";

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

describe("registerUser", () => {
  // The first answer sets the CSRF cookie, as GET /api/v1/ does.
  function mockCsrfThen(response: Response) {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return new Response(JSON.stringify({ status: "ok", version: "v1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    fetchMock.mockResolvedValueOnce(response);

    return fetchMock;
  }

  test("sends the account in JSON, with the CSRF token and the user's language", async () => {
    await i18n.changeLanguage("cs");
    const fetchMock = mockCsrfThen(
      new Response(
        JSON.stringify({
          id: 7,
          email: "diana@test.com",
          display_name: "dkolarov",
          message: "Account created successfully.",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await registerUser({
      display_name: "dkolarov",
      email: "diana@test.com",
      password: "TestPassword123!",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/register/",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          display_name: "dkolarov",
          email: "diana@test.com",
          password: "TestPassword123!",
        }),
      }),
    );

    const headers = (fetchMock.mock.calls[1][1] as RequestInit).headers as Headers;

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    // The new account gets the language of the request (api-plan §10.1).
    expect(headers.get("Accept-Language")).toBe("cs");
    expect(response).toEqual({
      id: 7,
      email: "diana@test.com",
      display_name: "dkolarov",
      message: "Account created successfully.",
    });
  });

  test("rejects with the code and the field messages of a 400", async () => {
    mockCsrfThen(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Please correct the highlighted fields.",
            fields: { password: ["This password is too common."] },
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const error = await registerUser({
      display_name: "dkolarov",
      email: "diana@test.com",
      password: "password123",
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect({
      status: (error as ApiError).status,
      code: (error as ApiError).code,
      message: (error as ApiError).message,
      fields: (error as ApiError).fields,
    }).toEqual({
      status: 400,
      code: "validation_error",
      message: "Please correct the highlighted fields.",
      fields: { password: ["This password is too common."] },
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
