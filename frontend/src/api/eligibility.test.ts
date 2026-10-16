import { afterEach, describe, expect, test, vi } from "vitest";

import { createEligibilityRequest } from "./eligibility";

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

describe("createEligibilityRequest", () => {
  test("posts the project ids with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 9, status: "pending" }, 201));

    await createEligibilityRequest({ project_ids: [4, 7] });

    const [path, options] = fetchMock.mock.calls[1];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/tutor-eligibility-requests/");
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify({ project_ids: [4, 7] }));
  });
});
