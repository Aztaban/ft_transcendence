import { afterEach, describe, expect, test, vi } from "vitest";

import { getUnreadCount } from "./notifications";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("notifications API", () => {
  test("gets the unread count", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ count: 3 }));

    expect(await getUnreadCount()).toEqual({ count: 3 });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/notifications/unread-count/");
  });
});
