import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";
import type { LiveMessage } from "../../websocket/events";
import { makeRequest } from "../student/testUtils";
import { useRequestOverview } from "./useRequestOverview";

vi.mock("../../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("../../store/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true }) }));

// The last live refresh the hook asked for, to send it events.
const live = vi.hoisted(() => ({ refetch: null as ((message?: LiveMessage) => void) | null }));

vi.mock("../../websocket/LiveProvider", () => ({
  useLiveRefresh: (_events: unknown, refetch: (message?: LiveMessage) => void) => {
    live.refetch = refetch;
  },
}));

function list(count: number) {
  const results: EvaluationRequest[] = [makeRequest(1, "minishell", "pending")];

  return { count, next: count > 1 ? "next" : null, previous: null, results };
}

// Kept outside the test, so it stays the same object between renders, as on Home.
const queries = {
  open: { scope: "mine" as const, status: ["pending" as const] },
  done: { scope: "mine" as const, status: ["confirmed" as const], history: true },
};

beforeEach(() => {
  vi.mocked(listEvaluationRequests).mockImplementation(async (params) =>
    params?.history ? list(12) : list(3),
  );
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  live.refetch = null;
});

describe("useRequestOverview", () => {
  it("reads each list's real total from its count", async () => {
    const { result } = renderHook(() => useRequestOverview(queries, [], true));

    await waitFor(() => expect(result.current.done?.count).toBe(12));
    expect(result.current.open?.count).toBe(3);
    expect(listEvaluationRequests).toHaveBeenCalledWith(queries.open);
    expect(listEvaluationRequests).toHaveBeenCalledWith(queries.done);
  });

  it("asks for nothing until the workspace's role is confirmed", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useRequestOverview(queries, [], enabled),
      { initialProps: { enabled: false } },
    );

    expect(listEvaluationRequests).not.toHaveBeenCalled();
    expect(result.current).toEqual({});

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.open?.count).toBe(3));
  });

  it("keeps the last answer of a list whose refresh fails, and updates the others", async () => {
    const { result } = renderHook(() => useRequestOverview(queries, [], true));

    await waitFor(() => expect(result.current.done?.count).toBe(12));

    vi.mocked(listEvaluationRequests).mockImplementation(async (params) => {
      if (params?.history) {
        throw new Error("network");
      }

      return list(4);
    });
    act(() => live.refetch?.());

    await waitFor(() => expect(result.current.open?.count).toBe(4));
    expect(result.current.done?.count).toBe(12);
  });
});
