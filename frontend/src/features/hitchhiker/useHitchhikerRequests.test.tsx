import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import type { EvaluationRequest } from "../../types/evaluation";
import { LiveContext } from "../../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../../websocket/testSocket";
import { makeRequest } from "../student/testUtils";
import { useHitchhikerRequests } from "./useHitchhikerRequests";

vi.mock("../../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("../../store/AuthContext", () => ({ useAuth: vi.fn() }));

function page(results: EvaluationRequest[]) {
  return { count: results.length, next: null, previous: null, results };
}

function Probe() {
  const { openRequests, pickedRequests, hasError } = useHitchhikerRequests();
  const names = (requests: EvaluationRequest[]) =>
    requests.map((request) => request.project.name).join(",");

  return (
    <p>{hasError ? "error" : `open:${names(openRequests)} picked:${names(pickedRequests)}`}</p>
  );
}

function loggedIn(isAuthenticated: boolean) {
  vi.mocked(useAuth).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("useHitchhikerRequests", () => {
  it("does not call the API when nobody is logged in", () => {
    loggedIn(false);

    render(<Probe />);

    expect(listEvaluationRequests).not.toHaveBeenCalled();
  });

  it("loads the open queue and the picked requests once logged in", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests).mockImplementation(async (params) =>
      params?.scope === "open"
        ? page([makeRequest(1, "minishell", "pending")])
        : page([makeRequest(2, "push_swap", "confirmed")]),
    );

    render(<Probe />);

    expect(await screen.findByText("open:minishell picked:push_swap")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "open" });
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "picked" });
  });

  it("reports when the requests cannot be loaded", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    render(<Probe />);

    expect(await screen.findByText("error")).toBeTruthy();
  });
});

describe("useHitchhikerRequests live", () => {
  afterEach(() => {
    FakeSocket.reset();
  });

  it("re-fetches both lists when the eligibility changes, and keeps them if that fails", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(page([makeRequest(1, "minishell", "pending")]))
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([]))
      .mockRejectedValue(new Error("network"));

    render(
      <LiveContext.Provider value={openLiveSocket()}>
        <Probe />
      </LiveContext.Provider>,
    );
    await screen.findByText("open:minishell picked:");

    // The Hitchhiker can no longer evaluate minishell: it leaves the queue.
    act(() =>
      FakeSocket.latest().serverSend({ event: "eligibility.revoked", data: { project_id: 3 } }),
    );

    expect(await screen.findByText("open: picked:")).toBeTruthy();

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.created",
        data: { id: 5, status: "pending" },
      }),
    );

    await vi.waitFor(() => expect(listEvaluationRequests).toHaveBeenCalledTimes(6));
    await act(async () => {});
    expect(screen.getByText("open: picked:")).toBeTruthy();
  });
});
