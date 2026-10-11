import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import { makeRequest } from "./testUtils";
import { useStudentRequests } from "./useStudentRequests";

vi.mock("../../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("../../store/AuthContext", () => ({ useAuth: vi.fn() }));

function Probe() {
  const { requests, hasError } = useStudentRequests();

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

  it("loads the student's active requests once logged in", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [makeRequest(1, "push_swap", "pending")],
    });

    render(<Probe />);

    expect(await screen.findByText("push_swap")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "mine", history: false });
  });

  it("reports when the requests cannot be loaded", async () => {
    loggedIn(true);
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    render(<Probe />);

    expect(await screen.findByText("error")).toBeTruthy();
  });
});
