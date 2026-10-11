import { afterEach, describe, expect, test, vi } from "vitest";

import {
  confirmEvaluationRequest,
  declineEvaluationRequest,
  getEvaluationRequest,
  listEvaluationRequests,
} from "./evaluationRequests";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const emptyPage = { count: 0, next: null, previous: null, results: [] };

describe("listEvaluationRequests", () => {
  test("asks for the Hitchhiker queue with scope=open", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(emptyPage));

    expect(await listEvaluationRequests({ scope: "open" })).toEqual(emptyPage);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/evaluation-requests/?scope=open");
  });

  test("sends status and history filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(emptyPage));

    await listEvaluationRequests({ scope: "mine", status: ["confirmed"], history: false });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/evaluation-requests/?scope=mine&status=confirmed&history=false",
    );
  });

  test("calls the list without parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(emptyPage));

    await listEvaluationRequests();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/evaluation-requests/");
  });
});

describe("confirm and decline", () => {
  afterEach(() => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });

  function mockCsrfThen(body: unknown) {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(body));

    return fetchMock;
  }

  test("confirms with POST …/confirm/ and the CSRF token", async () => {
    const fetchMock = mockCsrfThen({ id: 7, status: "confirmed" });

    await confirmEvaluationRequest(7);

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe("/api/v1/evaluation-requests/7/confirm/");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBeUndefined();
  });

  test("declines with POST …/decline/", async () => {
    const fetchMock = mockCsrfThen({ id: 7, status: "pending" });

    await declineEvaluationRequest(7);

    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/evaluation-requests/7/decline/");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });
});

describe("getEvaluationRequest", () => {
  test("loads one request by id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: 7 }));

    await getEvaluationRequest(7);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/evaluation-requests/7/");
  });
});
