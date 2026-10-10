import { afterEach, describe, expect, test, vi } from "vitest";

import { createEvaluationRequest, listEvaluationRequests } from "./evaluationRequests";

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

describe("createEvaluationRequest", () => {
  test("posts the project with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 17, status: "pending" }, 201));

    await createEvaluationRequest({ project_id: 4 });

    const [path, options] = fetchMock.mock.calls[1];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/evaluation-requests/");
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify({ project_id: 4 }));
  });
});
