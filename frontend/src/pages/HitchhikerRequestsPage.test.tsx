import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
import type { EvaluationRequest } from "../types/evaluation";
import HitchhikerRequestsPage from "./HitchhikerRequestsPage";

vi.mock("../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));

function page(results: EvaluationRequest[]) {
  return { count: results.length, next: null, previous: null, results };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("HitchhikerRequestsPage", () => {
  it("loads the open requests with scope=open", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    render(<HitchhikerRequestsPage />);

    expect(screen.getByText("Loading requests…")).toBeTruthy();
    expect(await screen.findByText("No open requests")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({ scope: "open" });
  });

  it("shows a card per open request with when it was requested and the note", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([
        { ...makeRequest(1, "born2beroot", "pending"), note: "Need help with LVM." },
        makeRequest(2, "push_swap", "pending"),
      ]),
    );

    render(<HitchhikerRequestsPage />);

    expect(await screen.findByRole("heading", { name: "born2beroot" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();
    expect(screen.getAllByText(/^Requested /)).toHaveLength(2);
    expect(screen.getByText("Need help with LVM.")).toBeTruthy();
    expect(screen.getByText("No note from the student.")).toBeTruthy();
  });

  it("keeps the Review button disabled until slot picking exists", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(1, "minishell", "pending")]),
    );

    render(<HitchhikerRequestsPage />);

    const review = (await screen.findByRole("button", { name: "Review" })) as HTMLButtonElement;

    expect(review.disabled).toBe(true);
    expect(screen.getByText("Slot picking coming soon")).toBeTruthy();
  });

  it("filters the cards by project", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(1, "born2beroot", "pending"), makeRequest(2, "push_swap", "pending")]),
    );

    render(<HitchhikerRequestsPage />);
    await screen.findByRole("heading", { name: "born2beroot" });

    fireEvent.click(screen.getByRole("button", { name: "push_swap 1" }));

    expect(screen.queryByRole("heading", { name: "born2beroot" })).toBeNull();
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All 2" }));

    expect(screen.getByRole("heading", { name: "born2beroot" })).toBeTruthy();
  });

  it("sorts the cards by request date", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([
        { ...makeRequest(1, "older", "pending"), created_at: "2026-10-01T09:00:00Z" },
        { ...makeRequest(2, "newer", "pending"), created_at: "2026-10-05T09:00:00Z" },
      ]),
    );

    render(<HitchhikerRequestsPage />);
    await screen.findByRole("heading", { name: "older" });

    const titles = () =>
      [...document.querySelectorAll(".hitchhiker-requests__card h2")].map(
        (heading) => heading.textContent,
      );

    expect(titles()).toEqual(["newer", "older"]);

    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "oldest" } });

    expect(titles()).toEqual(["older", "newer"]);
  });

  it("shows an error when the requests cannot be loaded", async () => {
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    render(<HitchhikerRequestsPage />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the requests. Please try again later.",
    );
  });
});
