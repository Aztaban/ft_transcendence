import { afterEach, describe, expect, test, vi } from "vitest";

import { sendSCMessage } from "./scMessages";

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

describe("sendSCMessage", () => {
  test("posts the message with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 3, created_at: "2026-10-17T10:00:00Z" }, 201),
    );

    expect(await sendSCMessage({ body: "The 3rd floor fridge is broken again." })).toEqual({
      id: 3,
      created_at: "2026-10-17T10:00:00Z",
    });

    const [path, options] = fetchMock.mock.calls[1];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/sc-messages/");
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify({ body: "The 3rd floor fridge is broken again." }));
  });
});
