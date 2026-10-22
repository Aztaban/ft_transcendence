import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createEligibilityRequest,
  listEligibilityRequests,
  reviewEligibilityRequest,
} from "./eligibility";

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

describe("reviewEligibilityRequest", () => {
  test("posts the decision and note with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 9, status: "approved" }));

    await reviewEligibilityRequest(9, { decision: "approved", review_note: "Welcome!" });

    const [path, options] = fetchMock.mock.calls[1];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/tutor-eligibility-requests/9/review/");
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify({ decision: "approved", review_note: "Welcome!" }));
  });
});

describe("listEligibilityRequests", () => {
  test("sends status, ordering and page, but not page 1", async () => {
    const emptyPage = { count: 0, next: null, previous: null, results: [] };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse(emptyPage));

    await listEligibilityRequests("pending", { page: 1 });
    await listEligibilityRequests("approved", { ordering: "-created_at", page: 3 });

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/tutor-eligibility-requests/?status=pending",
      "/api/v1/tutor-eligibility-requests/?status=approved&ordering=-created_at&page=3",
    ]);
  });
});
