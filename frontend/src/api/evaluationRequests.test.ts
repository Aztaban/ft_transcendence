import { afterEach, describe, expect, test, vi } from "vitest";

import { listEvaluationRequests } from "./evaluationRequests";

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
