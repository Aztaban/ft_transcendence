import { afterEach, describe, expect, test, vi } from "vitest";

import { deleteAdminUser, listAdminUsers, reactivateAdminUser, suspendAdminUser } from "./admin";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function emptyPage() {
  return new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listAdminUsers", () => {
  test("asks for the first page without filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(emptyPage());

    expect(await listAdminUsers()).toEqual({ count: 0, next: null, previous: null, results: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admin/users/");
  });

  test("sends only the filters that have a value", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      // A response body can be read only once, so each call gets a new one.
      .mockImplementation(() => Promise.resolve(emptyPage()));

    await listAdminUsers({ q: "ann", role: "tutor", status: "suspended", page: 2 });
    await listAdminUsers({ q: "", status: "active", page: 1 });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/admin/users/?q=ann&role=tutor&status=suspended&page=2",
      "/api/v1/admin/users/?status=active",
    ]);
  });
});

describe("account actions", () => {
  test("send the reason as JSON to each endpoint", async () => {
    // POST and DELETE send the CSRF token from the cookie (api-plan §5.4).
    document.cookie = "csrftoken=test-token; path=/";
    const user = { id: 7, status: "suspended" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    expect(await suspendAdminUser(7, "Spam")).toEqual(user);
    await reactivateAdminUser(7, "Appeal accepted");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await deleteAdminUser(7, "Left 42")).toBeUndefined();

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      ["/api/v1/admin/users/7/suspend/", "POST", JSON.stringify({ reason: "Spam" })],
      ["/api/v1/admin/users/7/reactivate/", "POST", JSON.stringify({ reason: "Appeal accepted" })],
      ["/api/v1/admin/users/7/", "DELETE", JSON.stringify({ reason: "Left 42" })],
    ]);
  });
});
