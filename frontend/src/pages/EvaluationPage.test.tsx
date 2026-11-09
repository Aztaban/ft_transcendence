import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getTutorEligibility } from "../api/eligibility";
import {
  cancelEvaluationRequest,
  confirmEvaluationRequest,
  declineEvaluationRequest,
  getEvaluationRequest,
  overrideCancelEvaluationRequest,
  overrideReleaseEvaluationRequest,
} from "../api/evaluationRequests";
import { makeRequest } from "../features/student/testUtils";
import { LiveContext } from "../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../websocket/testSocket";
import EvaluationPage from "./EvaluationPage";

// The viewer: the student of `makeRequest` (id 1) unless a test changes it, the workspaces their
// real roles open (only the student one unless a test adds the Hitchhiker one) and their real
// roles (none unless a test needs a Head Tutor or Admin).
const viewer = vi.hoisted(() => ({ id: 1, workspaces: ["STUDENT"], roles: [] as string[] }));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    user: { id: viewer.id },
    roles: viewer.roles,
    isLoaded: true,
    refresh: () => {},
  }),
}));

vi.mock("../store/RoleContext", () => ({
  useRole: () => ({
    activeRole: "STUDENT",
    setActiveRole: () => {},
    availableRoles: viewer.workspaces,
  }),
}));

vi.mock("../api/evaluationRequests", () => ({
  cancelEvaluationRequest: vi.fn(),
  getEvaluationRequest: vi.fn(),
  confirmEvaluationRequest: vi.fn(),
  declineEvaluationRequest: vi.fn(),
  overrideCancelEvaluationRequest: vi.fn(),
  overrideReleaseEvaluationRequest: vi.fn(),
}));

vi.mock("../api/eligibility", () => ({ getTutorEligibility: vi.fn() }));

const awaiting = makeRequest(7, "push_swap", "awaiting_confirmation");

afterEach(() => {
  viewer.id = 1;
  viewer.workspaces = ["STUDENT"];
  viewer.roles = [];
  cleanup();
  vi.resetAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/evaluations/7"]}>
      <Routes>
        <Route path="/evaluations/:id" element={<EvaluationPage />} />
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/requests/:id" element={<div>Pick slot page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function getButton(name: RegExp | string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("EvaluationPage", () => {
  it("shows the proposed slot and the tip, without the Hitchhiker (R18)", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaiting);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "A HITCHHIKER has taken your request" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();
    expect(screen.getByText("—", { selector: "dd" })).toBeTruthy();
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

  // #691: e.g. another Hitchhiker picked it before this one opened the notification (§5.6).
  it("says the evaluation is no longer available when the first load answers 404", async () => {
    vi.mocked(getEvaluationRequest).mockRejectedValue(new ApiError(404, "Not found.", "not_found"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This evaluation is no longer available. It may have been cancelled or declined.",
    );
    expect(screen.queryByText("This evaluation could not be loaded.")).toBeNull();
  });

  // From a request that is gone, another notification opens a request that fails to load: the
  // page is reused with a new id, and must not keep the old "no longer available".
  it("says it could not be loaded when the next request fails after one that was gone", async () => {
    vi.mocked(getEvaluationRequest)
      .mockRejectedValueOnce(new ApiError(404, "Not found.", "not_found"))
      .mockRejectedValueOnce(new Error("network"));
    render(
      <MemoryRouter initialEntries={["/evaluations/7"]}>
        <Link to="/evaluations/8">Next notification</Link>
        <Routes>
          <Route path="/evaluations/:id" element={<EvaluationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText(
      "This evaluation is no longer available. It may have been cancelled or declined.",
    );

    fireEvent.click(screen.getByRole("link", { name: "Next notification" }));

    expect(await screen.findByText("This evaluation could not be loaded.")).toBeTruthy();
    expect(getEvaluationRequest).toHaveBeenLastCalledWith(8);
    expect(screen.queryByText(/no longer available/)).toBeNull();
  });

  it("still says it could not be loaded when the first load fails otherwise", async () => {
    vi.mocked(getEvaluationRequest).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This evaluation could not be loaded.",
    );
  });
});

// #690: the `evaluation.created` notification opens this page, but slots are picked on
// /requests/{id}.
describe("EvaluationPage link to the slot picking", () => {
  // `makeRequest(7, "push_swap", …)` is for the project with id 7.
  const pushSwap = { id: 7, slug: "push_swap", name: "push_swap" };
  const minishell = { id: 3, slug: "minishell", name: "minishell" };

  beforeEach(() => {
    vi.mocked(getTutorEligibility).mockResolvedValue([minishell, pushSwap]);
  });

  it("names the Hitchhiker once the student has confirmed", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "confirmed"));

    renderPage();

    expect(await screen.findByText("Hitchhiker", { selector: "dd" })).toBeTruthy();
  });

  it("offers a Hitchhiker who is not the student to pick a slot for a pending request", async () => {
    viewer.id = 9;
    viewer.workspaces = ["STUDENT", "HITCHHIKER"];
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));
    renderPage();

    const link = await screen.findByRole("link", { name: "Pick a slot" });

    expect(getTutorEligibility).toHaveBeenCalledWith(9);
    expect(link.getAttribute("href")).toBe("/requests/7");

    fireEvent.click(link);

    expect(screen.getByText("Pick slot page")).toBeTruthy();
  });

  // A Head Tutor or Admin sees every request, also for projects they may not evaluate (§5.6).
  it("does not offer it to a Head Tutor who may not evaluate the project", async () => {
    viewer.id = 9;
    viewer.workspaces = ["STUDENT", "HITCHHIKER"];
    vi.mocked(getTutorEligibility).mockResolvedValue([minishell]);
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));
    renderPage();

    await screen.findByRole("heading", { name: "Waiting for a Hitchhiker" });
    await waitFor(() => expect(getTutorEligibility).toHaveBeenCalledWith(9));
    await act(async () => {});

    expect(screen.queryByRole("link", { name: "Pick a slot" })).toBeNull();
  });

  it("does not offer it when the eligibility cannot be loaded", async () => {
    viewer.id = 9;
    viewer.workspaces = ["STUDENT", "HITCHHIKER"];
    vi.mocked(getTutorEligibility).mockRejectedValue(new Error("network"));
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));
    renderPage();

    await screen.findByRole("heading", { name: "Waiting for a Hitchhiker" });
    await waitFor(() => expect(getTutorEligibility).toHaveBeenCalled());
    await act(async () => {});

    expect(screen.queryByRole("link", { name: "Pick a slot" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not offer it to the student of the request", async () => {
    viewer.workspaces = ["STUDENT", "HITCHHIKER"];
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));
    renderPage();

    await screen.findByRole("heading", { name: "Waiting for a Hitchhiker" });

    expect(screen.queryByRole("link", { name: "Pick a slot" })).toBeNull();
    expect(getTutorEligibility).not.toHaveBeenCalled();
  });

  it("does not offer it without the Hitchhiker workspace", async () => {
    viewer.id = 9;
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "pending"));
    renderPage();

    await screen.findByRole("heading", { name: "Waiting for a Hitchhiker" });

    expect(screen.queryByRole("link", { name: "Pick a slot" })).toBeNull();
  });

  it("does not offer it once the request is no longer pending", async () => {
    viewer.id = 9;
    viewer.workspaces = ["STUDENT", "HITCHHIKER"];
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "confirmed"));
    renderPage();

    await screen.findByRole("heading", { name: "The evaluation is scheduled" });

    expect(screen.queryByRole("link", { name: "Pick a slot" })).toBeNull();
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

describe("EvaluationPage live, after the request is gone", () => {
  afterEach(() => {
    FakeSocket.reset();
    vi.useRealTimers();
  });

  // Reconnecting re-fetches (§9.4); a re-fetch that fails on the network keeps what is shown.
  it("keeps saying it is no longer available when a later re-fetch fails otherwise", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getEvaluationRequest)
      .mockResolvedValueOnce(awaiting)
      .mockRejectedValueOnce(new ApiError(404, "Not found.", "not_found"))
      .mockRejectedValueOnce(new Error("network"));

    render(
      <LiveContext.Provider value={openLiveSocket()}>
        <MemoryRouter initialEntries={["/evaluations/7"]}>
          <Routes>
            <Route path="/evaluations/:id" element={<EvaluationPage />} />
          </Routes>
        </MemoryRouter>
      </LiveContext.Provider>,
    );
    await screen.findByText("Needs your answer");

    function reconnect() {
      act(() => {
        FakeSocket.latest().serverClose(1006);
        vi.advanceTimersByTime(1000);
        FakeSocket.latest().serverOpen();
      });
    }

    reconnect();
    await screen.findByText(
      "This evaluation is no longer available. It may have been cancelled or declined.",
    );

    reconnect();
    await vi.waitFor(() => expect(getEvaluationRequest).toHaveBeenCalledTimes(3));
    await act(async () => {});

    expect(screen.getByRole("alert").textContent).toBe(
      "This evaluation is no longer available. It may have been cancelled or declined.",
    );
    expect(screen.queryByText("Needs your answer")).toBeNull();
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
  // Everyone but the student sees who picked (R18).
  const awaitingForPicker = {
    ...awaiting,
    picked_by: { id: 2, display_name: "Hitchhiker", avatar_url: null },
  };

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

    expect(await screen.findByText("Waiting for the student")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Decline/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
  });

  it("speaks to the Hitchhiker, not the student", async () => {
    viewer.id = 2;
    vi.mocked(getEvaluationRequest).mockResolvedValue(awaitingForPicker);
    renderPage();

    expect(await screen.findByText("Waiting for the student")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "You proposed a slot" })).toBeTruthy();
    expect(screen.getByText("The student has to accept or decline your proposal.")).toBeTruthy();
    expect(screen.getByText("Student", { selector: "dt" })).toBeTruthy();
    expect(screen.getByText("Please be on time. The student is counting on you.")).toBeTruthy();
    expect(screen.queryByText("Needs your answer")).toBeNull();
    expect(screen.queryByText(/has taken your request/)).toBeNull();
  });

  it("uses neutral words for someone who is neither the student nor the Hitchhiker", async () => {
    viewer.id = 9;
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "confirmed"));
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "The evaluation is scheduled" }),
    ).toBeTruthy();
  });
});

describe("EvaluationPage override", () => {
  // A confirmed evaluation that has not started yet: the student is user 1, the Hitchhiker user 2.
  const upcoming = {
    ...makeRequest(7, "push_swap", "confirmed"),
    starts_at: "2099-03-02T15:00:00Z",
    ends_at: "2099-03-02T15:45:00Z",
  };

  function asHeadTutor() {
    viewer.id = 50;
    viewer.roles = ["student", "tutor", "head_tutor"];
  }

  function overrideSection() {
    return screen.queryByRole("region", { name: "Override" });
  }

  function dialog() {
    return screen.getByRole("dialog");
  }

  function typeReason(reason: string) {
    fireEvent.change(within(dialog()).getByLabelText("Reason"), { target: { value: reason } });
  }

  it("offers a Head Tutor release and cancel on someone else's upcoming evaluation", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    renderPage();

    await screen.findByRole("heading", { name: "push_swap" });
    const section = overrideSection() as HTMLElement;

    expect(
      within(section)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Release the slot", "Cancel the request"]);
  });

  it("releases the slot with a reason", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    vi.mocked(overrideReleaseEvaluationRequest).mockResolvedValue(
      makeRequest(7, "push_swap", "pending"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Release the slot" }));

    expect(screen.getByRole("dialog", { name: "Release the slot for push_swap?" })).toBeTruthy();

    const confirm = within(dialog()).getByRole("button", { name: "Release" }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);
    typeReason("  The Hitchhiker is suspended  ");
    fireEvent.click(confirm);

    const notice = await screen.findByText(
      "The slot was released. The request is back in the queue.",
    );

    expect(overrideReleaseEvaluationRequest).toHaveBeenCalledWith(7, "The Hitchhiker is suspended");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(notice);
    expect(screen.queryByRole("button", { name: "Release the slot" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel the request" })).toBeTruthy();
  });

  it("cancels the request with a reason", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    vi.mocked(overrideCancelEvaluationRequest).mockResolvedValue({
      ...upcoming,
      status: "cancelled",
      cancelled_by: { id: 50, display_name: "Head Tutor", avatar_url: null },
      cancelled_at: "2026-11-08T10:00:00Z",
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel the request" }));

    expect(dialog().textContent).toContain("This cannot be undone.");

    typeReason("The student left 42");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel the request" }));

    expect(await screen.findByText("The request was cancelled.")).toBeTruthy();
    expect(overrideCancelEvaluationRequest).toHaveBeenCalledWith(7, "The student left 42");
    expect(overrideSection()).toBeNull();
  });

  it("closes the popup without a request on Cancel", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel the request" }));
    typeReason("The student left 42");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(overrideCancelEvaluationRequest).not.toHaveBeenCalled();
  });

  it("offers only cancel once the slot has started", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue(makeRequest(7, "push_swap", "confirmed"));
    renderPage();

    await screen.findByRole("heading", { name: "push_swap" });

    expect(screen.getByRole("button", { name: "Cancel the request" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Release the slot" })).toBeNull();
  });

  it("offers nothing once a result is recorded", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue({
      ...makeRequest(7, "push_swap", "confirmed"),
      result: "passed",
    });
    renderPage();

    await screen.findByRole("heading", { name: "push_swap" });

    expect(overrideSection()).toBeNull();
  });

  it("is offered to an Admin, but not to a Hitchhiker who is not a Head Tutor", async () => {
    viewer.id = 50;
    viewer.roles = ["student", "admin"];
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    const view = renderPage();

    await screen.findByRole("heading", { name: "push_swap" });
    expect(overrideSection()).toBeTruthy();

    view.unmount();
    viewer.roles = ["student", "tutor"];
    renderPage();

    await screen.findByRole("heading", { name: "push_swap" });
    expect(overrideSection()).toBeNull();
  });

  it("is not offered on a Head Tutor's own request or slot", async () => {
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    viewer.roles = ["student", "tutor", "head_tutor"];

    // The student of the request (user 1)…
    const view = renderPage();

    await screen.findByRole("heading", { name: "push_swap" });
    expect(overrideSection()).toBeNull();

    // …and the Hitchhiker who picked it (user 2) use their normal buttons instead.
    view.unmount();
    viewer.id = 2;
    renderPage();

    await screen.findByRole("heading", { name: "push_swap" });
    expect(overrideSection()).toBeNull();
  });

  it("says why nothing was done when the slot started meanwhile", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    vi.mocked(overrideReleaseEvaluationRequest).mockRejectedValue(
      new ApiError(409, "The evaluation has already started.", "evaluation_already_started"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Release the slot" }));
    typeReason("The Hitchhiker is suspended");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Release" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The slot has already started, so it can no longer be released.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(getEvaluationRequest).toHaveBeenCalledTimes(2));
  });

  it("shows the backend's reason message inside the popup", async () => {
    asHeadTutor();
    vi.mocked(getEvaluationRequest).mockResolvedValue(upcoming);
    vi.mocked(overrideCancelEvaluationRequest).mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields.", "validation_error", {
        reason: ["Ensure this field has no more than 500 characters."],
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel the request" }));
    typeReason("The student left 42");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel the request" }));

    expect((await within(dialog()).findByRole("alert")).textContent).toBe(
      "Ensure this field has no more than 500 characters.",
    );
  });
});
