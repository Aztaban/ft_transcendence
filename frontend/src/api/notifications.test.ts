import { afterEach, describe, expect, test, vi } from "vitest";

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The first request asks the backend for a CSRF cookie (§5.4); the second one is the POST.
function mockPost(answer: Response) {
  const fetchMock = vi.spyOn(globalThis, "fetch");

  fetchMock.mockImplementationOnce(async () => {
    document.cookie = "csrftoken=test-csrf-token; path=/";

    return jsonResponse({ status: "ok", version: "v1" });
  });
  fetchMock.mockResolvedValueOnce(answer);

  return fetchMock;
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

  test("marks one notification as read with the CSRF token", async () => {
    const read = {
      id: 12,
      type: "evaluation.created",
      payload: { request_id: 17, project: { id: 4, slug: "libft", name: "Libft" } },
      target_url: "/evaluations/17",
      read_at: "2026-10-24T10:00:00Z",
      created_at: "2026-10-24T09:00:00Z",
    };
    const fetchMock = mockPost(jsonResponse(read));

    expect(await markNotificationRead(12)).toEqual(read);

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe("/api/v1/notifications/12/read/");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
  });

  test("marks all notifications as read (204, no body)", async () => {
    const fetchMock = mockPost(new Response(null, { status: 204 }));

    expect(await markAllNotificationsRead()).toBeUndefined();

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe("/api/v1/notifications/read-all/");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
  });
});
