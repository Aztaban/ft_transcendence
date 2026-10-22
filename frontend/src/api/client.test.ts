import { afterEach, describe, expect, test, vi } from "vitest";

import i18n from "../i18n";
import { apiRequest } from "./client";
import { updateCurrentUser } from "./users";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function csrfHeader(call: unknown[]) {
  return new Headers((call[1] as RequestInit | undefined)?.headers).get("X-CSRFToken");
}

describe("apiRequest Accept-Language", () => {
  test("asks the backend for the current language", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse({}));

    await apiRequest("/api/v1/things/");
    await i18n.changeLanguage("cs");
    await apiRequest("/api/v1/things/");

    expect(
      fetchMock.mock.calls.map((call) =>
        new Headers((call[1] as RequestInit | undefined)?.headers).get("Accept-Language"),
      ),
    ).toEqual(["en", "cs"]);
  });
});

describe("apiRequest CSRF", () => {
  test("adds the token from the cookie to unsafe methods", async () => {
    document.cookie = "csrftoken=cookie-token; path=/";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse({}));

    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
      await apiRequest("/api/v1/things/", { method });
    }

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.map(csrfHeader)).toEqual(Array(5).fill("cookie-token"));
  });

  test("does not add the token to safe methods", async () => {
    document.cookie = "csrftoken=cookie-token; path=/";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse({}));

    await apiRequest("/api/v1/things/");
    await apiRequest("/api/v1/things/", { method: "GET" });

    expect(fetchMock.mock.calls.map(csrfHeader)).toEqual([null, null]);
  });

  test("gets the cookie from GET /api/v1/ first when it is missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=fresh-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await apiRequest("/api/v1/things/", { method: "POST" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/");
    expect(csrfHeader(fetchMock.mock.calls[0])).toBeNull();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/things/");
    expect(csrfHeader(fetchMock.mock.calls[1])).toBe("fresh-token");
  });

  test("reads the cookie again on every request, so a new token after login is used", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse({}));

    document.cookie = "csrftoken=before-login; path=/";
    await apiRequest("/api/v1/things/", { method: "POST" });
    document.cookie = "csrftoken=after-login; path=/";
    await apiRequest("/api/v1/things/", { method: "POST" });

    expect(fetchMock.mock.calls.map(csrfHeader)).toEqual(["before-login", "after-login"]);
  });

  test("keeps the caller's other headers", async () => {
    document.cookie = "csrftoken=cookie-token; path=/";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse({}));

    await apiRequest("/api/v1/things/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-CSRFToken")).toBe("cookie-token");
  });

  test("sends the token when the profile is saved (PATCH /users/me/)", async () => {
    document.cookie = "csrftoken=cookie-token; path=/";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await updateCurrentUser({ display_name: "dkolarov" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/users/me/");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(csrfHeader(fetchMock.mock.calls[0])).toBe("cookie-token");
  });
});
