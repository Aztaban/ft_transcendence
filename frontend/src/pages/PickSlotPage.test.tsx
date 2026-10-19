import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getEvaluationRequest, pickSlot } from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
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

describe("PickSlotPage timing and field errors (#563)", () => {
  it("shows the backend's field errors under the start time and the duration", async () => {
    vi.mocked(pickSlot).mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields.", "validation_error", {
        starts_at: ["Start must be on a 15-minute boundary."],
        ends_at: ["Duration must be between 15 and 120 minutes."],
      }),
    );
    renderPage();
    await chooseTomorrowAt1015();

    fireEvent.click(getButton("Submit"));

    expect(await screen.findByText("Start must be on a 15-minute boundary.")).toBeTruthy();
    expect(screen.getByText("Duration must be between 15 and 120 minutes.")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Start time" }).getAttribute("aria-describedby")).toBe(
      "slot-start-error",
    );
    expect(screen.getByRole("group", { name: "Duration" }).getAttribute("aria-describedby")).toBe(
      "slot-duration-error",
    );
    expect(screen.getByRole("alert").textContent).toBe("Please correct the highlighted fields.");

    // Choosing again clears the messages about the previous choice.
    fireEvent.click(getButton("10:30"));

    expect(screen.queryByText("Start must be on a 15-minute boundary.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks for a later time when the chosen start became too soon before submitting", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Choose a slot for push_swap" });

    // Opened at 08:00: 08:30 is exactly 30 minutes ahead, so it can be chosen.
    fireEvent.click(getButton("08:00"));
    fireEvent.click(getButton("08:30"));

    expect(getButton("Submit").disabled).toBe(false);

    // A minute later the same start is too soon.
    vi.setSystemTime(new Date(2026, 9, 12, 8, 1));
    fireEvent.click(getButton("Submit"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The chosen start is now less than 30 minutes away. Please choose a later time.",
    );
    expect(getButton("Submit").disabled).toBe(true);
    expect(pickSlot).not.toHaveBeenCalled();
  });

  it("offers every day up to the end of the 14-day window", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Choose a slot for push_swap" });

    const days = within(screen.getByRole("group", { name: "Day" })).getAllByRole("button");

    // Mon 12 Oct 08:00 + 14 days ends on Mon 26 Oct: today and the next 14 days.
    expect(days).toHaveLength(15);
    expect(days[0].textContent).toBe("Today");
  });
});
