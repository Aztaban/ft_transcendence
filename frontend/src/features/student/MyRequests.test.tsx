import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listEvaluationRequests,
  type ListEvaluationRequestsParams,
} from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";
import { LiveContext } from "../../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../../websocket/testSocket";
import MyRequests from "./MyRequests";
import { makeRequest } from "./testUtils";

vi.mock("../../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));

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
      row.lastElementChild?.textContent,
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

describe("MyRequests live", () => {
  afterEach(() => {
    FakeSocket.reset();
  });

  it("loads both lists again from their first page when a request changes", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      makeRequest(100 + index, `past-${index}`, "cancelled"),
    );
    let activeStatus: EvaluationRequest["status"] = "pending";

    vi.mocked(listEvaluationRequests).mockImplementation(
      async (params: ListEvaluationRequestsParams = {}) => {
        if (!params.history) {
          return page([makeRequest(1, "push_swap", activeStatus)]);
        }

        return params.page === 2
          ? page([makeRequest(200, "oldest", "expired")], 21)
          : page(firstPage, 21, "https://localhost/api/v1/evaluation-requests/?page=2");
      },
    );

    render(
      <LiveContext.Provider value={openLiveSocket()}>
        <MyRequests />
      </LiveContext.Provider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Show more past requests (1 left)" }),
    );
    await screen.findByRole("heading", { name: "oldest" });

    activeStatus = "awaiting_confirmation";
    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 1, status: "awaiting_confirmation" },
      }),
    );

    await vi.waitFor(() =>
      expect(rowStatuses("Active")).toEqual([["push_swap", "Needs your confirmation"]]),
    );
    expect(rowStatuses("Past")).toHaveLength(20);
    expect(screen.queryByText("Loading your requests…")).toBeNull();
    expect(listEvaluationRequests).toHaveBeenLastCalledWith({
      scope: "mine",
      history: true,
      page: 1,
    });
  });
});
