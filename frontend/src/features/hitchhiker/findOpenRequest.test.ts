import { afterEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";
import { makeRequest } from "../student/testUtils";
import { findOpenRequest } from "./findOpenRequest";

vi.mock("../../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));

function page(results: EvaluationRequest[], next: string | null = null) {
  return { count: results.length, next, previous: null, results };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("findOpenRequest", () => {
  it("finds the request on the first page", async () => {
    const request = makeRequest(7, "push_swap", "pending");
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([request]));

    expect(await findOpenRequest(7)).toEqual(request);
    expect(vi.mocked(listEvaluationRequests).mock.calls).toEqual([
      [{ scope: "open", project: undefined, page: 1 }],
    ]);
  });

  it("reads the next pages until it finds the request", async () => {
    const request = makeRequest(7, "push_swap", "pending");
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(page([makeRequest(1, "push_swap", "pending")], "?page=2"))
      .mockResolvedValueOnce(page([request]));

    expect(await findOpenRequest(7, "push_swap")).toEqual(request);
    expect(vi.mocked(listEvaluationRequests).mock.calls).toEqual([
      [{ scope: "open", project: "push_swap", page: 1 }],
      [{ scope: "open", project: "push_swap", page: 2 }],
    ]);
  });

  it("returns null when the request is not open anymore", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(1, "push_swap", "pending")]),
    );

    expect(await findOpenRequest(7)).toBeNull();
  });
});
