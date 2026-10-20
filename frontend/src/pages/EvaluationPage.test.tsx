import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import {
  cancelEvaluationRequest,
  confirmEvaluationRequest,
  declineEvaluationRequest,
  getEvaluationRequest,
} from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
import EvaluationPage from "./EvaluationPage";

// The viewer: the student of `makeRequest` (id 1) unless a test changes it.
const viewer = vi.hoisted(() => ({ id: 1 }));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ user: { id: viewer.id }, roles: [], isLoaded: true, refresh: () => {} }),
}));

vi.mock("../api/evaluationRequests", () => ({
  cancelEvaluationRequest: vi.fn(),
  getEvaluationRequest: vi.fn(),
  confirmEvaluationRequest: vi.fn(),
  declineEvaluationRequest: vi.fn(),
}));

const awaiting = makeRequest(7, "push_swap", "awaiting_confirmation");

afterEach(() => {
  viewer.id = 1;
  cleanup();
  vi.resetAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/evaluations/7"]}>
      <Routes>
        <Route path="/evaluations/:id" element={<EvaluationPage />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function getButton(name: RegExp | string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("EvaluationPage", () => {
  it("shows the proposed slot with the Hitchhiker and the tip", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "A HITCHHIKER has taken your request" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();
    expect(screen.getByText("Hitchhiker", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText("45 min")).toBeTruthy();
    expect(screen.getByText("Needs your answer")).toBeTruthy();
    expect(screen.getByText("Please be on time and prepared. Good luck!")).toBeTruthy();
    expect(getEvaluationRequest).toHaveBeenCalledWith(7);
  });

  it("accepts the slot and shows the popup, which goes back home", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);
    vi.mocked(confirmEvaluationRequest).mockResolvedValue({ ...awaiting, status: "confirmed" });
    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    fireEvent.click(getButton(/Accept/));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(confirmEvaluationRequest).toHaveBeenCalledWith(7);
    expect(screen.getByRole("heading", { name: "Your evaluation is scheduled" })).toBeTruthy();

    fireEvent.click(screen.getByTestId("evaluation-dialog-backdrop"));

    expect(screen.getByText("Home page")).toBeTruthy();
  });

  it("asks before declining, then shows that the request is back in the queue", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);
    vi.mocked(declineEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));
    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    fireEvent.click(getButton(/Decline this time/));

    expect(declineEvaluationRequest).not.toHaveBeenCalled();
    expect(
      screen.getByText("Decline this time? Another Hitchhiker can then propose a new slot."),
    ).toBeTruthy();

    fireEvent.click(getButton("Yes, decline"));

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(declineEvaluationRequest).toHaveBeenCalledWith(7);
    expect(screen.getByRole("heading", { name: "Waiting for a Hitchhiker" })).toBeTruthy();
  });

  it("can keep the slot after starting to decline", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);
    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    fireEvent.click(getButton(/Decline this time/));
    fireEvent.click(getButton("Keep it"));

    expect(getButton(/Accept/)).toBeTruthy();
  });

  it("explains when the slot has already started", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);
    vi.mocked(confirmEvaluationRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "evaluation_already_started"),
    );
    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    fireEvent.click(getButton(/Accept/));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This slot has already started, so it can no longer be accepted.",
    );
  });

  it("shows no buttons for a request that is not waiting for an answer", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Waiting for a Hitchhiker" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });
});

describe("EvaluationPage cancel (#595)", () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  it("cancels a pending request after asking", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));
    vi.mocked(cancelEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "cancelled"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel request" }));

    const dialog = screen.getByRole("dialog", { name: "Cancel this request?" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel request" }));

    expect(
      await screen.findByRole("heading", { name: "This request is no longer active" }),
    ).toBeTruthy();
    expect(cancelEvaluationRequest).toHaveBeenCalledWith(7);
    expect(screen.getByRole("status").textContent).toBe(
      "Your request has been cancelled. You can create a new one anytime.",
    );
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
  });

  it("also offers it for a proposed slot that has not started", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue({
      ...awaiting,
      starts_at: tomorrow,
      ends_at: tomorrow,
    });
    renderPage();

    expect(await screen.findByRole("button", { name: "Cancel request" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Accept/ })).toBeTruthy();
  });

  it("does not offer it once the request has ended or the slot has started", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "cancelled"));
    renderPage();

    await screen.findByRole("heading", { name: "This request is no longer active" });

    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
  });
});

describe("EvaluationPage for the picking Hitchhiker", () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // §10.4: confirm, decline and cancel are for the own student only.
  it("shows the proposal without Accept, Decline or Cancel", async () => {
    viewer.id = 2;
    vi.mocked(getEvaluationRequest).mockResolvedValue({
      ...awaiting,
      starts_at: tomorrow,
      ends_at: tomorrow,
    });
    renderPage();

    expect(await screen.findByText("Needs your answer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Decline/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
  });
});
