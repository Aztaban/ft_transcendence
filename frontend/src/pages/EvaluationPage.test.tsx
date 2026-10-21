import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import {
  confirmEvaluationRequest,
  declineEvaluationRequest,
  getEvaluationRequest,
} from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
import { LiveContext } from "../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../websocket/testSocket";
import EvaluationPage from "./EvaluationPage";

vi.mock("../api/evaluationRequests", () => ({
  getEvaluationRequest: vi.fn(),
  confirmEvaluationRequest: vi.fn(),
  declineEvaluationRequest: vi.fn(),
}));

const awaiting = makeRequest(7, "push_swap", "awaiting_confirmation");

afterEach(() => {
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

  it("says the evaluation is no longer available when accepting answers 404", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);
    vi.mocked(confirmEvaluationRequest).mockRejectedValue(
      new ApiError(404, "Not found.", "not_found"),
    );
    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    fireEvent.click(getButton(/Accept/));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This evaluation is no longer available. It may have been cancelled or declined.",
    );
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });

  it("says the evaluation is no longer available when declining answers 404", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);
    vi.mocked(declineEvaluationRequest).mockRejectedValue(
      new ApiError(404, "Not found.", "not_found"),
    );
    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    fireEvent.click(getButton(/Decline this time/));
    fireEvent.click(getButton("Yes, decline"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This evaluation is no longer available. It may have been cancelled or declined.",
    );
    expect(screen.queryByRole("button", { name: "Yes, decline" })).toBeNull();
  });

  it("shows no buttons for a request that is not waiting for an answer", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Waiting for a Hitchhiker" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });
});

describe("EvaluationPage live", () => {
  function renderLive() {
    return render(
      <LiveContext.Provider value={openLiveSocket()}>
        <MemoryRouter initialEntries={["/evaluations/7"]}>
          <Routes>
            <Route path="/evaluations/:id" element={<EvaluationPage />} />
          </Routes>
        </MemoryRouter>
      </LiveContext.Provider>,
    );
  }

  afterEach(() => {
    FakeSocket.reset();
    vi.useRealTimers();
  });

  it("re-fetches when this request changes and ignores other requests", async () => {
    vi.mocked(getEvaluationRequest)
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValueOnce(makeRequest(7, "push_swap", "pending"));

    renderLive();
    await screen.findByText("Needs your answer");

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 8, status: "awaiting_confirmation" },
      }),
    );

    expect(getEvaluationRequest).toHaveBeenCalledTimes(1);

    // The Hitchhiker released the slot: the request is back in the queue.
    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.released",
        data: { id: 7, status: "pending" },
      }),
    );

    expect(await screen.findByText("In the queue")).toBeTruthy();
    expect(getEvaluationRequest).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Needs your answer")).toBeNull();
  });

  it("re-fetches after a reconnect and keeps the request if that fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getEvaluationRequest)
      .mockResolvedValueOnce(awaiting)
      .mockRejectedValueOnce(new Error("network"));

    renderLive();
    await screen.findByText("Needs your answer");

    act(() => {
      FakeSocket.latest().serverClose(1006);
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverOpen();
    });

    await vi.waitFor(() => expect(getEvaluationRequest).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.getByText("Needs your answer")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // e.g. the evaluation was cancelled while the backend restarted: the re-fetch after the
  // reconnect answers 404 (§5.5).
  it("says the evaluation is no longer available when the re-fetch answers 404", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getEvaluationRequest)
      .mockResolvedValueOnce(awaiting)
      .mockRejectedValueOnce(new ApiError(404, "Not found.", "not_found"));

    renderLive();
    await screen.findByText("Needs your answer");

    act(() => {
      FakeSocket.latest().serverClose(1006);
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverOpen();
    });

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This evaluation is no longer available. It may have been cancelled or declined.",
    );
    expect(screen.queryByText("Needs your answer")).toBeNull();
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });
});
