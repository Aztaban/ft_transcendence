import { afterEach, describe, expect, test, vi } from "vitest";

import { getUnreadCount, listNotifications } from "./notifications";

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

  test("lists the first page of notifications", async () => {
    const page = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 12,
          type: "evaluation.created",
          payload: { request_id: 17, project: { id: 4, slug: "libft", name: "Libft" } },
          target_url: "/evaluations/17",
          read_at: null,
          created_at: "2026-10-24T09:00:00Z",
        },
      ],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(page));

    expect(await listNotifications()).toEqual(page);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/notifications/");
  });

  test("asks for a later page with ?page=", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ count: 25, next: null, previous: null, results: [] }));

    await listNotifications(2);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/notifications/?page=2");
  });
});
