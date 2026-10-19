import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getEvaluationRequest, pickSlot } from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
import { LiveContext } from "../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../websocket/testSocket";
import PickSlotPage from "./PickSlotPage";

vi.mock("../api/evaluationRequests", () => ({
  getEvaluationRequest: vi.fn(),
  pickSlot: vi.fn(),
}));

beforeEach(() => {
  // Only Date is faked, so promises and timers keep working. Local time: Mon 12 Oct 2026 08:00.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 12, 8, 0));
  vi.mocked(getEvaluationRequest).mockResolvedValue({
    ...makeRequest(7, "push_swap", "pending"),
    note: "Last evaluation before my deadline!",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/requests/7"]}>
      <Routes>
        <Route path="/requests/:id" element={<PickSlotPage />} />
        <Route path="/requests" element={<div>Requests list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function getButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

async function chooseTomorrowAt1015() {
  await screen.findByRole("heading", { name: "Choose a slot for push_swap" });
  fireEvent.click(getButton("Tomorrow"));
  fireEvent.click(getButton("10:00"));
  fireEvent.click(getButton("10:15"));
}

describe("PickSlotPage", () => {
  it("shows the request and its note", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Choose a slot for push_swap" }),
    ).toBeTruthy();
    expect(screen.getByText("Last evaluation before my deadline!")).toBeTruthy();
    expect(getEvaluationRequest).toHaveBeenCalledWith(7);
  });

  it("disables start times less than 30 minutes ahead", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Choose a slot for push_swap" });

    fireEvent.click(getButton("08:00"));

    expect(getButton("08:15").disabled).toBe(true);
    expect(getButton("08:30").disabled).toBe(false);
  });

  it("keeps Submit disabled until a start time is chosen", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Choose a slot for push_swap" });

    expect(getButton("Submit").disabled).toBe(true);

    await chooseTomorrowAt1015();

    expect(getButton("Submit").disabled).toBe(false);
    expect(screen.getByText(/\(45 min\)$/)).toBeTruthy();
  });

  it("sends the slot and shows the popup, which goes back to the requests", async () => {
    vi.mocked(pickSlot).mockResolvedValue(makeRequest(7, "push_swap", "awaiting_confirmation"));
    renderPage();
    await chooseTomorrowAt1015();
    fireEvent.click(getButton("60 min"));

    fireEvent.click(getButton("Submit"));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(pickSlot).toHaveBeenCalledWith(7, {
      starts_at: new Date(2026, 9, 13, 10, 15).toISOString(),
      ends_at: new Date(2026, 9, 13, 11, 15).toISOString(),
    });

    fireEvent.click(screen.getByTestId("success-dialog-backdrop"));

    expect(screen.getByText("Requests list")).toBeTruthy();
  });

  it("explains when the Hitchhiker already has an evaluation at that time", async () => {
    vi.mocked(pickSlot).mockRejectedValue(new ApiError(409, "Conflict", "slot_overlaps"));
    renderPage();
    await chooseTomorrowAt1015();

    fireEvent.click(getButton("Submit"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You already have an evaluation at that time. Choose another slot.",
    );
  });

  it("does not offer a slot when the request is no longer open", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(
      makeRequest(7, "push_swap", "awaiting_confirmation"),
    );
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe("This request is no longer open.");
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });
});

describe("PickSlotPage live", () => {
  afterEach(() => {
    FakeSocket.reset();
  });

  it("shows that the request is no longer open when another Hitchhiker picks it", async () => {
    vi.mocked(getEvaluationRequest)
      .mockResolvedValueOnce(makeRequest(7, "push_swap", "pending"))
      .mockResolvedValueOnce(makeRequest(7, "push_swap", "awaiting_confirmation"));

    render(
      <LiveContext.Provider value={openLiveSocket()}>
        <MemoryRouter initialEntries={["/requests/7"]}>
          <Routes>
            <Route path="/requests/:id" element={<PickSlotPage />} />
          </Routes>
        </MemoryRouter>
      </LiveContext.Provider>,
    );
    await screen.findByRole("button", { name: "Submit" });

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.created",
        data: { id: 8, status: "pending" },
      }),
    );

    expect(getEvaluationRequest).toHaveBeenCalledTimes(1);

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 7, status: "awaiting_confirmation" },
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe("This request is no longer open.");
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(getEvaluationRequest).toHaveBeenCalledTimes(2);
  });

  it("does not re-fetch after the Hitchhiker's own pick", async () => {
    vi.mocked(pickSlot).mockResolvedValue(makeRequest(7, "push_swap", "awaiting_confirmation"));
    render(
      <LiveContext.Provider value={openLiveSocket()}>
        <MemoryRouter initialEntries={["/requests/7"]}>
          <Routes>
            <Route path="/requests/:id" element={<PickSlotPage />} />
          </Routes>
        </MemoryRouter>
      </LiveContext.Provider>,
    );
    await chooseTomorrowAt1015();
    fireEvent.click(getButton("Submit"));
    await screen.findByRole("dialog");

    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 7, status: "awaiting_confirmation" },
      }),
    );

    expect(getEvaluationRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores its own pick's event when it arrives before the server's answer", async () => {
    let answerPick: (value: ReturnType<typeof makeRequest>) => void = () => {};

    vi.mocked(pickSlot).mockReturnValue(
      new Promise((resolve) => {
        answerPick = resolve;
      }),
    );
    render(
      <LiveContext.Provider value={openLiveSocket()}>
        <MemoryRouter initialEntries={["/requests/7"]}>
          <Routes>
            <Route path="/requests/:id" element={<PickSlotPage />} />
          </Routes>
        </MemoryRouter>
      </LiveContext.Provider>,
    );
    await chooseTomorrowAt1015();
    fireEvent.click(getButton("Submit"));

    // §9.3: the event is sent on commit, usually before the POST response arrives.
    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.slot_picked",
        data: { id: 7, status: "awaiting_confirmation" },
      }),
    );

    expect(getEvaluationRequest).toHaveBeenCalledTimes(1);

    await act(async () => answerPick(makeRequest(7, "push_swap", "awaiting_confirmation")));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(getEvaluationRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("This request is no longer open.")).toBeNull();
  });
});
