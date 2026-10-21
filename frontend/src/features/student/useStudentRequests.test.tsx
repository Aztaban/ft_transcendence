import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import type { EvaluationRequest } from "../../types/evaluation";
import { LiveContext } from "../../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../../websocket/testSocket";
import { makeRequest } from "./testUtils";
import { useStudentRequests } from "./useStudentRequests";

vi.mock("../../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("../../store/AuthContext", () => ({ useAuth: vi.fn() }));

function Probe() {
  const { requests, isLoading, hasError } = useStudentRequests();

  if (isLoading) {
    return <p>loading</p>;
  }

  return <p>{hasError ? "error" : requests.map((request) => request.project.name).join(",")}</p>;
}

function loggedIn(isAuthenticated: boolean) {
  vi.mocked(useAuth).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("useStudentRequests", () => {
  it("does not call the API when nobody is logged in", () => {
    loggedIn(false);

    render(<Probe />);

    expect(listEvaluationRequests).not.toHaveBeenCalled();
  });

  it("loads all of the student's requests once logged in", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [makeRequest(1, "push_swap", "pending")],
    });

    render(<Probe />);

    expect(await screen.findByText("push_swap")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "mine" });
  });

  it("reports loading until the first answer arrives", () => {
    loggedIn(true);
    // An answer that never comes: the hook stays in its first load.
    vi.mocked(listEvaluationRequests).mockReturnValue(new Promise(() => {}));

    render(<Probe />);

    expect(screen.getByText("loading")).toBeTruthy();
  });

  it("reports when the requests cannot be loaded", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    render(<Probe />);

    expect(await screen.findByText("error")).toBeTruthy();
  });
});

describe("useStudentRequests live", () => {
  function page(results: EvaluationRequest[]) {
    return { count: results.length, next: null, previous: null, results };
  }

  afterEach(() => {
    FakeSocket.reset();
  });

  it("re-fetches when one of the requests changes, and keeps them if that fails", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(page([makeRequest(1, "push_swap", "pending")]))
      .mockResolvedValueOnce(
        page([
          makeRequest(1, "push_swap", "awaiting_confirmation"),
          makeRequest(2, "minishell", "pending"),
        ]),
      )
      .mockRejectedValueOnce(new Error("network"));

    render(
      <LiveContext.Provider value={openLiveSocket()}>
        <Probe />
      </LiveContext.Provider>,
    );
    await screen.findByText("push_swap");

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 1, status: "awaiting_confirmation" },
      }),
    );
    // The refresh runs in the background: the requests stay, no loading state.
    expect(screen.getByText("push_swap")).toBeTruthy();

    expect(await screen.findByText("push_swap,minishell")).toBeTruthy();

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.expired",
        data: { id: 2, status: "expired" },
      }),
    );

    await vi.waitFor(() => expect(listEvaluationRequests).toHaveBeenCalledTimes(3));
    await act(async () => {});
    expect(screen.getByText("push_swap,minishell")).toBeTruthy();
  });
});
