import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import {
  cancelEvaluationRequest,
  listEvaluationRequests,
  releaseEvaluationRequest,
} from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
import { RoleProvider, useRole } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import PendingPage from "./PendingPage";

vi.mock("../api/evaluationRequests", () => ({
  listEvaluationRequests: vi.fn(),
  cancelEvaluationRequest: vi.fn(),
  releaseEvaluationRequest: vi.fn(),
}));

const HOUR = 60 * 60 * 1000;

// A request whose slot starts `hours` from now and lasts 45 minutes.
function scheduled(
  id: number,
  name: string,
  hours: number,
  status: EvaluationRequest["status"] = "confirmed",
) {
  const start = Date.now() + hours * HOUR;

  return {
    ...makeRequest(id, name, status),
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + 45 * 60 * 1000).toISOString(),
  };
}

function page(results: EvaluationRequest[]) {
  return { count: results.length, next: null, previous: null, results };
}

function SwitchToHitchhiker() {
  const { setActiveRole } = useRole();

  return (
    <button type="button" onClick={() => setActiveRole("HITCHHIKER")}>
      switch
    </button>
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <SwitchToHitchhiker />
        <PendingPage />
      </RoleProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("PendingPage", () => {
  it("loads a student's confirmed evaluations, soonest first", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderPage();

    expect(await screen.findByText("Nothing scheduled yet")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({
      scope: "mine",
      status: ["confirmed"],
      history: false,
      ordering: "starts_at",
    });
  });

  it("loads the evaluations a Hitchhiker picked", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderPage();
    await screen.findByText("Nothing scheduled yet");
    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    await screen.findByText("Pick an open request and it will appear here.");
    expect(listEvaluationRequests).toHaveBeenLastCalledWith({
      scope: "picked",
      history: false,
      ordering: "starts_at",
    });
  });

  it("groups the evaluations by day with their details", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([scheduled(1, "push_swap", 26), scheduled(2, "minishell", 24 * 5)]),
    );

    renderPage();

    const days = await screen.findAllByRole("heading", { level: 2 });
    const card = screen.getByRole("heading", { name: "push_swap" }).closest("li") as HTMLElement;

    expect(days).toHaveLength(2);
    expect(within(card).getByText("Scheduled")).toBeTruthy();
    expect(within(card).getByText("45 min")).toBeTruthy();
    expect(within(card).getByText("42 Prague")).toBeTruthy();
    // The "Hitchhiker" label and the test user, who is also named "Hitchhiker".
    expect(within(card).getAllByText("Hitchhiker")).toHaveLength(2);
  });

  it("opens the preview with the countdown", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([scheduled(1, "push_swap", 26)]));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Preview push_swap" }));

    const dialog = screen.getByRole("dialog", { name: "push_swap" });

    expect(within(dialog).getByText(/^1 day( 1 hour)?$/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels a student's evaluation and shows the released popup", async () => {
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(page([scheduled(1, "push_swap", 26)]))
      .mockResolvedValueOnce(page([]));
    vi.mocked(cancelEvaluationRequest).mockResolvedValue(makeRequest(1, "push_swap", "cancelled"));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel push_swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel evaluation" }));

    expect(await screen.findByText("Your slot has been released!")).toBeTruthy();
    expect(cancelEvaluationRequest).toHaveBeenCalledWith(1);
    expect(await screen.findByText("Nothing scheduled yet")).toBeTruthy();

    fireEvent.click(screen.getByTestId("released-dialog-backdrop"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("releases the slot when a Hitchhiker cancels", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([scheduled(1, "push_swap", 26, "awaiting_confirmation")]),
    );
    vi.mocked(releaseEvaluationRequest).mockResolvedValue(makeRequest(1, "push_swap", "pending"));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    const card = (await screen.findByRole("heading", { name: "push_swap" })).closest(
      "li",
    ) as HTMLElement;

    expect(within(card).getByText("Waiting for the student")).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "Cancel push_swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel evaluation" }));

    expect(await screen.findByText("Your slot has been released!")).toBeTruthy();
    expect(releaseEvaluationRequest).toHaveBeenCalledWith(1);
    expect(cancelEvaluationRequest).not.toHaveBeenCalled();
  });

  it("explains when the evaluation has already started", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([scheduled(1, "push_swap", 26)]));
    vi.mocked(cancelEvaluationRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "evaluation_already_started"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel push_swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel evaluation" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This evaluation has already started, so it can't be cancelled.",
    );
  });

  it("does not allow cancelling an evaluation in progress", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([scheduled(1, "push_swap", -0.2)]));

    renderPage();

    expect(await screen.findByText("In progress")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Cancel push_swap" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
