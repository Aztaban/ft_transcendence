import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
import type { EvaluationRequest } from "../types/evaluation";
import { LiveContext } from "../websocket/LiveProvider";
import { LiveSocket } from "../websocket/LiveSocket";
import { createFakeSocket, FakeSocket } from "../websocket/testSocket";
import HitchhikerRequestsPage from "./HitchhikerRequestsPage";

vi.mock("../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));

function page(results: EvaluationRequest[]) {
  return { count: results.length, next: null, previous: null, results };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HitchhikerRequestsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.useRealTimers();
  FakeSocket.reset();
});

// Renders the page with an open WebSocket that the test controls like the server.
function renderLive() {
  const live = new LiveSocket({
    url: "wss://localhost/ws/",
    createSocket: createFakeSocket,
    random: () => 1,
  });

  live.connect();
  FakeSocket.latest().serverOpen();

  render(
    <MemoryRouter>
      <LiveContext.Provider value={live}>
        <HitchhikerRequestsPage />
      </LiveContext.Provider>
    </MemoryRouter>,
  );

  return live;
}

describe("HitchhikerRequestsPage", () => {
  it("loads the open requests with scope=open", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderPage();

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

    renderPage();

    expect(await screen.findByRole("heading", { name: "born2beroot" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();
    expect(screen.getAllByText(/^Requested /)).toHaveLength(2);
    expect(screen.getByText("Need help with LVM.")).toBeTruthy();
    expect(screen.getByText("No note from the student.")).toBeTruthy();
  });

  it("links Review to the request", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(7, "minishell", "pending")]),
    );

    renderPage();

    const review = await screen.findByRole("link", { name: "Review the minishell request" });

    expect(review.getAttribute("href")).toBe("/requests/7");
  });

  it("filters the cards by project", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([makeRequest(1, "born2beroot", "pending"), makeRequest(2, "push_swap", "pending")]),
    );

    renderPage();
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

    renderPage();
    await screen.findByRole("heading", { name: "older" });

    const titles = () =>
      [...document.querySelectorAll(".hitchhiker-requests__card h2")].map(
        (heading) => heading.textContent,
      );

    expect(titles()).toEqual(["newer", "older"]);

    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "oldest" } });

    expect(titles()).toEqual(["older", "newer"]);
  });

  it("re-fetches the queue in the background when a request is picked", async () => {
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(
        page([makeRequest(1, "born2beroot", "pending"), makeRequest(2, "push_swap", "pending")]),
      )
      .mockResolvedValueOnce(page([makeRequest(1, "born2beroot", "pending")]));

    renderLive();
    await screen.findByRole("heading", { name: "push_swap" });

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 2, status: "awaiting_confirmation" },
      }),
    );

    // The cards stay on screen while the new list loads (no loading skeleton).
    expect(screen.queryByText("Loading requests…")).toBeNull();
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();

    expect(await screen.findByRole("heading", { name: "born2beroot" })).toBeTruthy();
    await vi.waitFor(() => expect(screen.queryByRole("heading", { name: "push_swap" })).toBeNull());
    expect(listEvaluationRequests).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when the Hitchhiker's eligibility changes", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderLive();
    await screen.findByText("No open requests");

    act(() =>
      FakeSocket.latest().serverSend({
        event: "eligibility.decided",
        data: { id: 9, status: "approved" },
      }),
    );

    await vi.waitFor(() => expect(listEvaluationRequests).toHaveBeenCalledTimes(2));
  });

  it("ignores events that don't change the queue", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderLive();
    await screen.findByText("No open requests");

    act(() => FakeSocket.latest().serverSend({ event: "notification.created", data: { id: 3 } }));

    expect(listEvaluationRequests).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after the connection comes back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderLive();
    await screen.findByText("No open requests");

    act(() => {
      FakeSocket.latest().serverClose(1006);
      vi.advanceTimersByTime(1000);
      FakeSocket.latest().serverOpen();
    });

    await vi.waitFor(() => expect(listEvaluationRequests).toHaveBeenCalledTimes(2));
  });

  it("keeps the cards when a background refresh fails", async () => {
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(page([makeRequest(2, "push_swap", "pending")]))
      .mockRejectedValueOnce(new Error("network"));

    renderLive();
    await screen.findByRole("heading", { name: "push_swap" });

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.created",
        data: { id: 5, status: "pending" },
      }),
    );

    await vi.waitFor(() => expect(listEvaluationRequests).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("drops the project filter when its last request leaves the queue", async () => {
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(
        page([makeRequest(1, "born2beroot", "pending"), makeRequest(2, "push_swap", "pending")]),
      )
      .mockResolvedValueOnce(page([makeRequest(1, "born2beroot", "pending")]));

    renderLive();
    await screen.findByRole("heading", { name: "push_swap" });
    fireEvent.click(screen.getByRole("button", { name: /^push_swap/ }));

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 2, status: "awaiting_confirmation" },
      }),
    );

    expect(await screen.findByRole("heading", { name: "born2beroot" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^All/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows an error when the requests cannot be loaded", async () => {
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the requests. Please try again later.",
    );
  });
});
