import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";
import MyRequests from "./MyRequests";
import { makeRequest } from "./testUtils";

vi.mock("../../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function page(results: EvaluationRequest[], count = results.length) {
  return { count, next: null, previous: null, results };
}

function pastConfirmed(id: number, name: string, result: EvaluationRequest["result"]) {
  return { ...makeRequest(id, name, "confirmed"), is_history: true, result };
}

function rowStatuses(groupName: string) {
  const group = screen.getByRole("heading", { name: groupName }).parentElement as HTMLElement;

  return within(group)
    .getAllByRole("listitem")
    .map((row) => [
      within(row).getByRole("heading").textContent,
      row.lastElementChild?.textContent,
    ]);
}

describe("MyRequests", () => {
  it("asks for the student's own requests", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    render(<MyRequests />);

    expect(await screen.findByText("You haven't requested an evaluation yet.")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "mine" });
  });

  it("splits active and past requests with their status", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([
        makeRequest(1, "push_swap", "pending"),
        makeRequest(2, "minishell", "awaiting_confirmation"),
        makeRequest(3, "cpp09", "confirmed"),
        pastConfirmed(4, "born2beroot", "passed"),
        pastConfirmed(5, "Fly-In", "failed"),
        pastConfirmed(6, "Codexion", null),
        makeRequest(7, "Agent Smith", "cancelled"),
        makeRequest(8, "The Answer Protocol", "expired"),
      ]),
    );

    render(<MyRequests />);
    await screen.findByRole("heading", { name: "Active" });

    expect(rowStatuses("Active")).toEqual([
      ["push_swap", "Waiting for a Hitchhiker"],
      ["minishell", "Needs your confirmation"],
      ["cpp09", "Confirmed"],
    ]);
    expect(rowStatuses("Past")).toEqual([
      ["born2beroot", "Passed"],
      ["Fly-In", "Failed"],
      ["Codexion", "Result pending"],
      ["Agent Smith", "Cancelled"],
      ["The Answer Protocol", "Expired"],
    ]);
  });

  it("says when there are no active requests and hides an empty past list", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(7, "push_swap", "cancelled")]),
    );

    render(<MyRequests />);

    expect(await screen.findByText("No active requests.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Past" })).toBeTruthy();

    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(1, "push_swap", "pending")]),
    );
    cleanup();
    render(<MyRequests />);

    await screen.findByRole("heading", { name: "Active" });
    expect(screen.queryByRole("heading", { name: "Past" })).toBeNull();
  });

  it("tells when only the newest requests are shown", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(1, "push_swap", "pending")], 21),
    );

    render(<MyRequests />);

    expect(await screen.findByText("Showing your 1 most recent requests.")).toBeTruthy();
  });

  it("shows an error when the requests cannot be loaded", async () => {
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    render(<MyRequests />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load your requests. Please try again later.",
    );
  });
});
