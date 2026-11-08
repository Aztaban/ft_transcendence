import { afterEach, describe, expect, test, vi } from "vitest";

import { listAdminUsers } from "./admin";

afterEach(() => {
  vi.restoreAllMocks();
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
