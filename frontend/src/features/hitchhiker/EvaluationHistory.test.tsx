import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { makeRequest } from "../student/testUtils";
import EvaluationHistory from "./EvaluationHistory";

afterEach(() => {
  cleanup();
});

function pastEvaluation(id: number, projectName: string, result: "passed" | "failed" | null) {
  return { ...makeRequest(id, projectName, "confirmed"), is_history: true, result };
}

describe("EvaluationHistory", () => {
  it("shows the empty state when there is no history", () => {
    render(<EvaluationHistory requests={[]} />);

    expect(screen.getByText("No history yet")).toBeTruthy();
  });

  it("shows the outcome of each past evaluation", () => {
    const requests = [
      pastEvaluation(1, "minishell", "passed"),
      pastEvaluation(2, "push_swap", "failed"),
      pastEvaluation(3, "cpp09", null),
      makeRequest(4, "born2beroot", "cancelled"),
      makeRequest(5, "Codexion", "expired"),
    ];

    render(<EvaluationHistory requests={requests} />);

    expect(screen.getByText("Passed")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("Result pending")).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
  });

  it("does not display active requests", () => {
    const requests = [
      makeRequest(1, "pending-project", "pending"),
      makeRequest(2, "awaiting-project", "awaiting_confirmation"),
      makeRequest(3, "upcoming-project", "confirmed"),
    ];

    render(<EvaluationHistory requests={requests} />);

    expect(screen.queryByText("pending-project")).toBeNull();
    expect(screen.queryByText("awaiting-project")).toBeNull();
    expect(screen.queryByText("upcoming-project")).toBeNull();
    expect(screen.getByText("No history yet")).toBeTruthy();
  });
});
