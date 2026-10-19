import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import {
  cancelEvaluationRequest,
  listEvaluationRequests,
  type ListEvaluationRequestsParams,
} from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";
import MyRequests from "./MyRequests";
import { makeRequest } from "./testUtils";

vi.mock("../../api/evaluationRequests", () => ({
  listEvaluationRequests: vi.fn(),
  cancelEvaluationRequest: vi.fn(),
}));

// A slot that has not started yet, so the request can still be cancelled.
function upcoming(request: EvaluationRequest): EvaluationRequest {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return { ...request, starts_at: start, ends_at: start };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function page(results: EvaluationRequest[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

function pastConfirmed(id: number, name: string, result: EvaluationRequest["result"]) {
  return { ...makeRequest(id, name, "confirmed"), is_history: true, result };
}

// Answers like the API: separate lists for active (`history=false`) and past (`history=true`).
function mockLists(
  active: ReturnType<typeof page>,
  past: ReturnType<typeof page> | ((pageNumber: number) => ReturnType<typeof page>),
) {
  vi.mocked(listEvaluationRequests).mockImplementation(
    async (params: ListEvaluationRequestsParams = {}) => {
      if (!params.history) {
        return active;
      }

      return typeof past === "function" ? past(params.page ?? 1) : past;
    },
  );
}

function rowStatuses(groupName: string) {
  const group = screen.getByRole("heading", { name: groupName }).parentElement as HTMLElement;

  return within(group)
    .getAllByRole("listitem")
    .map((row) => [
      within(row).getByRole("heading").textContent,
      row.querySelector(".my-requests__status")?.textContent,
    ]);
}

describe("MyRequests", () => {
  it("loads active and past requests as two separate lists", async () => {
    mockLists(page([]), page([]));

    render(<MyRequests />);

    expect(await screen.findByText("You haven't requested an evaluation yet.")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "mine", history: false, page: 1 });
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "mine", history: true, page: 1 });
  });

  it("shows active and past requests with their status", async () => {
    mockLists(
      page([
        makeRequest(1, "push_swap", "pending"),
        makeRequest(2, "minishell", "awaiting_confirmation"),
        makeRequest(3, "cpp09", "confirmed"),
      ]),
      page([
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

  it("keeps an older active request visible next to more than 20 newer past ones", async () => {
    const newerPast = Array.from({ length: 20 }, (_, index) =>
      makeRequest(100 + index, `past-${index}`, "cancelled"),
    );

    mockLists(
      page([{ ...makeRequest(1, "push_swap", "pending"), created_at: "2026-09-01T09:00:00Z" }]),
      page(newerPast, 21, "https://localhost/api/v1/evaluation-requests/?page=2"),
    );

    render(<MyRequests />);
    await screen.findByRole("heading", { name: "Active" });

    expect(rowStatuses("Active")).toEqual([["push_swap", "Waiting for a Hitchhiker"]]);
    expect(screen.queryByText("No active requests.")).toBeNull();
    expect(rowStatuses("Past")).toHaveLength(20);
  });

  it("loads the next page of past requests with Show more", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      makeRequest(100 + index, `past-${index}`, "cancelled"),
    );

    mockLists(page([]), (pageNumber) =>
      pageNumber === 1
        ? page(firstPage, 21, "https://localhost/api/v1/evaluation-requests/?page=2")
        : page([makeRequest(200, "oldest", "expired")], 21),
    );

    render(<MyRequests />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Show more past requests (1 left)" }),
    );

    expect(await screen.findByRole("heading", { name: "oldest" })).toBeTruthy();
    expect(rowStatuses("Past")).toHaveLength(21);
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "mine", history: true, page: 2 });
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("says when there are no active requests and hides an empty past list", async () => {
    mockLists(page([]), page([makeRequest(7, "push_swap", "cancelled")]));

    render(<MyRequests />);

    expect(await screen.findByText("No active requests.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Past" })).toBeTruthy();

    cleanup();
    mockLists(page([makeRequest(1, "push_swap", "pending")]), page([]));
    render(<MyRequests />);

    await screen.findByRole("heading", { name: "Active" });
    expect(screen.queryByRole("heading", { name: "Past" })).toBeNull();
  });

  it("shows an error when the requests cannot be loaded", async () => {
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    render(<MyRequests />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load your requests. Please try again later.",
    );
  });
});

describe("MyRequests cancel (#595)", () => {
  it("offers Cancel only on active requests whose slot has not started", async () => {
    mockLists(
      page([
        makeRequest(1, "push_swap", "pending"),
        upcoming(makeRequest(2, "minishell", "awaiting_confirmation")),
        upcoming(makeRequest(3, "cpp09", "confirmed")),
        makeRequest(4, "Fly-In", "confirmed"),
      ]),
      page([makeRequest(5, "born2beroot", "cancelled")]),
    );

    render(<MyRequests />);
    await screen.findByRole("heading", { name: "Active" });

    expect(
      screen.getAllByRole("button", { name: /^Cancel the/ }).map((button) => button.textContent),
    ).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Cancel the push_swap request" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel the Fly-In request" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel the born2beroot request" })).toBeNull();
  });

  it("cancels after asking and moves the request to the past list", async () => {
    let cancelled = false;

    vi.mocked(listEvaluationRequests).mockImplementation(
      async (params: ListEvaluationRequestsParams = {}) => {
        if (!params.history) {
          return page(cancelled ? [] : [makeRequest(1, "push_swap", "pending")]);
        }

        return page(cancelled ? [makeRequest(1, "push_swap", "cancelled")] : []);
      },
    );
    vi.mocked(cancelEvaluationRequest).mockImplementation(async () => {
      cancelled = true;

      return makeRequest(1, "push_swap", "cancelled");
    });

    render(<MyRequests />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel the push_swap request" }));

    const dialog = screen.getByRole("dialog", { name: "Cancel this request?" });

    expect(
      within(dialog).getByText("Hitchhikers won't see the request anymore.", { exact: false }),
    ).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel request" }));

    expect((await screen.findByRole("status")).textContent).toBe(
      "Your push_swap request was cancelled.",
    );
    expect(cancelEvaluationRequest).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("No active requests.")).toBeTruthy();
    expect(rowStatuses("Past")).toEqual([["push_swap", "Cancelled"]]);
  });

  it("keeps the request when the student changes their mind", async () => {
    mockLists(page([makeRequest(1, "push_swap", "pending")]), page([]));

    render(<MyRequests />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel the push_swap request" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep request" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cancelEvaluationRequest).not.toHaveBeenCalled();
  });

  it("explains in the dialog when the evaluation has already started", async () => {
    mockLists(page([upcoming(makeRequest(3, "cpp09", "confirmed"))]), page([]));
    vi.mocked(cancelEvaluationRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "evaluation_already_started"),
    );

    render(<MyRequests />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel the cpp09 request" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel request" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This evaluation has already started, so it can't be cancelled.",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
