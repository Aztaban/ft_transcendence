import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getEligibilityRequest, reviewEligibilityRequest } from "../api/eligibility";
import i18n from "../i18n";
import type { EligibilityRequest } from "../types/eligibility";
import type { UserProfile } from "../types/user";
import type { LiveMessage } from "../websocket/events";
import { EligibilityRequestRoute } from "./EligibilityRequestDetailPage";

// The shared /users/me/ store, as loaded for the logged-in user.
const currentUser = vi.hoisted(() => ({
  user: null as UserProfile | null,
  roles: [] as string[],
}));
// The last live refresh the page asked for, to send it events.
const live = vi.hoisted(() => ({ refetch: null as ((message?: LiveMessage) => void) | null }));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, isLoaded: true, refresh: () => {} }),
}));
vi.mock("../api/eligibility", () => ({
  getEligibilityRequest: vi.fn(),
  reviewEligibilityRequest: vi.fn(),
}));
vi.mock("../websocket/LiveProvider", () => ({
  useLiveRefresh: (_events: unknown, refetch: (message?: LiveMessage) => void) => {
    live.refetch = refetch;
  },
}));

function logIn(id: number, roles: string[]) {
  currentUser.user = {
    id,
    email: "user@42.cz",
    display_name: id === 42 ? "Bob" : "headtut",
    avatar_url: null,
    language: "en",
    roles: roles.map((name, index) => ({ id: index + 1, name: name as "student" })),
    intra_login: null,
  };
  currentUser.roles = roles;
}

function eligibilityRequest(extra: Partial<EligibilityRequest> = {}): EligibilityRequest {
  return {
    id: 9,
    requester: { id: 42, display_name: "Bob", avatar_url: null },
    projects: [
      { id: 4, slug: "libft", name: "Libft" },
      { id: 7, slug: "get_next_line", name: "get_next_line" },
    ],
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: "",
    created_at: "2026-10-09T08:00:00Z",
    ...extra,
  };
}

const approved = eligibilityRequest({
  status: "approved",
  reviewed_by: { id: 1, display_name: "headtut", avatar_url: null },
  reviewed_at: "2026-10-10T09:00:00Z",
  review_note: "Welcome!",
});

function BrowserBack() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(-1)}>
      Browser back
    </button>
  );
}

// `paths` are the pages opened in this tab, the last one shown: Back goes to the one before.
function renderPage(...paths: string[]) {
  const entries = paths.length > 0 ? paths : ["/eligibility-requests/9"];

  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <BrowserBack />
      <Routes>
        <Route path="/eligibility-requests/:id" element={<EligibilityRequestRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

function card() {
  return screen.getByRole("article");
}

beforeEach(() => {
  logIn(1, ["student", "tutor", "head_tutor"]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  currentUser.user = null;
  currentUser.roles = [];
  live.refetch = null;
});

describe("EligibilityRequestDetailPage", () => {
  it("shows the requester, the status, the date and every project", async () => {
    vi.mocked(getEligibilityRequest).mockResolvedValue(eligibilityRequest());

    renderPage();

    expect(await screen.findByRole("link", { name: "Bob" })).toBeTruthy();
    expect(getEligibilityRequest).toHaveBeenCalledWith(9);
    expect(screen.getByRole("heading", { level: 1, name: "Eligibility request" })).toBeTruthy();
    expect(document.title).toBe("Eligibility request · 42 Evals");
    expect(within(card()).getByText("Pending")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bob" }).getAttribute("href")).toBe("/people/42");
    expect(screen.getByRole("heading", { name: "2 projects" })).toBeTruthy();
    expect(
      within(card())
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Libft", "get_next_line"]);
    expect(card().querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-09T08:00:00Z");
  });

  it("lets a Head Tutor approve a pending request with a note", async () => {
    // The reload after the decision gets the decided request, as the server would answer.
    vi.mocked(getEligibilityRequest)
      .mockResolvedValueOnce(eligibilityRequest())
      .mockResolvedValue(approved);
    vi.mocked(reviewEligibilityRequest).mockResolvedValue(approved);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Bob's request" }));

    const dialog = screen.getByRole("dialog", { name: "Approve Bob's request?" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Welcome!" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect((await screen.findByRole("status")).textContent).toBe("Bob's request was approved.");
    expect(reviewEligibilityRequest).toHaveBeenCalledWith(9, {
      decision: "approved",
      review_note: "Welcome!",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(card()).getByText("Approved")).toBeTruthy();
    expect(within(card()).getByText("headtut")).toBeTruthy();
    expect(within(card()).getByText("Welcome!")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve Bob's request" })).toBeNull();
  });

  it("declines without a note", async () => {
    vi.mocked(getEligibilityRequest).mockResolvedValue(eligibilityRequest());
    vi.mocked(reviewEligibilityRequest).mockResolvedValue(
      eligibilityRequest({ status: "declined" }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Decline Bob's request" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Decline" }));

    expect((await screen.findByRole("status")).textContent).toBe("Bob's request was declined.");
    expect(reviewEligibilityRequest).toHaveBeenCalledWith(9, { decision: "declined" });
  });

  it("shows another Head Tutor's decision when they were faster", async () => {
    vi.mocked(getEligibilityRequest)
      .mockResolvedValueOnce(eligibilityRequest())
      .mockResolvedValueOnce(approved);
    vi.mocked(reviewEligibilityRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "eligibility_request_already_reviewed"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Decline Bob's request" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Decline" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Another Head Tutor already reviewed this request.",
    );
    expect(await within(card()).findByText("Approved")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getEligibilityRequest).toHaveBeenCalledTimes(2);
  });

  it("keeps other errors inside the dialog", async () => {
    vi.mocked(getEligibilityRequest).mockResolvedValue(eligibilityRequest());
    vi.mocked(reviewEligibilityRequest).mockRejectedValue(
      new ApiError(502, "API request failed: 502 Bad Gateway"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Bob's request" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));

    expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toBe(
      "Could not save the decision. Please try again.",
    );
  });

  it("does not let a Head Tutor review their own request", async () => {
    logIn(42, ["student", "tutor", "head_tutor"]);
    vi.mocked(getEligibilityRequest).mockResolvedValue(eligibilityRequest());

    renderPage();

    expect(
      await screen.findByText(
        "You can't review your own request. Another Head Tutor or an Admin will.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve Bob's request" })).toBeNull();
  });

  it("tells the requester what happens next, without review buttons", async () => {
    logIn(42, ["student", "tutor"]);
    vi.mocked(getEligibilityRequest).mockResolvedValue(eligibilityRequest());

    renderPage();

    expect(
      await screen.findByText(
        "A Head Tutor will approve or decline the whole request. You will get a notification.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Back to home/ }).getAttribute("href")).toBe("/");
  });

  it("shows the decision to the requester, with a way to send a new request", async () => {
    logIn(42, ["student", "tutor"]);
    vi.mocked(getEligibilityRequest).mockResolvedValue({
      ...approved,
      status: "declined",
      review_note: "Please finish the common core first.",
    });

    renderPage();

    expect(await within(await screen.findByRole("article")).findByText("Declined")).toBeTruthy();
    expect(screen.getByText("headtut")).toBeTruthy();
    expect(screen.getByText("Please finish the common core first.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Send a new request" }).getAttribute("href")).toBe(
      "/eligibility-requests/new",
    );
  });

  it.each([
    ["an Admin without a tutor role", 1, ["student", "admin"]],
    ["a requester who lost the tutor role", 42, ["student"]],
  ])("offers %s no page of the Hitchhiker workspace, only Home", async (_who, userId, roles) => {
    logIn(userId, roles);
    vi.mocked(getEligibilityRequest).mockResolvedValue({ ...approved, status: "declined" });

    renderPage();

    expect(await within(await screen.findByRole("article")).findByText("Declined")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to home/ }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: /All eligibility requests/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Send a new request" })).toBeNull();
  });

  // Moving between requests keeps the route: without a new page per id, the popup and its note
  // would land on the other request.
  it("starts fresh on another request: Back during a review does not approve that one", async () => {
    const first = eligibilityRequest({
      id: 5,
      requester: { id: 43, display_name: "Alice", avatar_url: null },
    });

    vi.mocked(getEligibilityRequest).mockImplementation(async (id) =>
      id === 5 ? first : eligibilityRequest(),
    );
    renderPage("/eligibility-requests/5", "/eligibility-requests/9");
    await screen.findByRole("link", { name: "Bob" });

    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));

    expect(await screen.findByRole("link", { name: "Alice" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(reviewEligibilityRequest).not.toHaveBeenCalled();
  });

  it("leads a Head Tutor back to all requests", async () => {
    vi.mocked(getEligibilityRequest).mockResolvedValue(eligibilityRequest());

    renderPage();

    expect(
      (await screen.findByRole("link", { name: /All eligibility requests/ })).getAttribute("href"),
    ).toBe("/eligibility-requests");
  });

  it("shows the not found page when the API answers 404", async () => {
    vi.mocked(getEligibilityRequest).mockRejectedValue(
      new ApiError(404, "Not found.", "not_found"),
    );

    renderPage();

    expect(await screen.findByText("Page not found.")).toBeTruthy();
  });

  it("does not call the API for an id that is not a number", async () => {
    renderPage("/eligibility-requests/abc");

    expect(await screen.findByText("Page not found.")).toBeTruthy();
    expect(getEligibilityRequest).not.toHaveBeenCalled();
  });

  it("shows an error when the request cannot be loaded", async () => {
    vi.mocked(getEligibilityRequest).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the request. Please try again later.",
    );
  });

  // Another Head Tutor's decision sends this one no event (§9.3), so the tab being shown does.
  it("keeps the decision when an older background reload answers after it", async () => {
    let answerOld: (value: EligibilityRequest) => void = () => {};

    vi.mocked(getEligibilityRequest)
      .mockResolvedValueOnce(eligibilityRequest())
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerOld = resolve;
        }),
      )
      .mockResolvedValue(approved);
    vi.mocked(reviewEligibilityRequest).mockResolvedValue(approved);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve Bob's request" }));

    // The tab is shown again while the dialog is open: a reload starts and is still on its way.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    expect((await screen.findByRole("status")).textContent).toBe("Bob's request was approved.");

    // The older reload answers last, with the request as it was before the decision.
    await act(async () => answerOld(eligibilityRequest()));

    expect(within(card()).getByText("Approved")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Bob's request was approved.");
    expect(screen.queryByRole("button", { name: "Approve Bob's request" })).toBeNull();
  });

  it("loads the request again when the tab is shown", async () => {
    vi.mocked(getEligibilityRequest)
      .mockResolvedValueOnce(eligibilityRequest())
      .mockResolvedValueOnce(approved);

    renderPage();
    await screen.findByRole("button", { name: "Approve Bob's request" });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await within(card()).findByText("Approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve Bob's request" })).toBeNull();
    expect(getEligibilityRequest).toHaveBeenCalledTimes(2);
  });

  it("loads the request again when it is decided elsewhere, ignoring other requests", async () => {
    logIn(42, ["student", "tutor"]);
    vi.mocked(getEligibilityRequest)
      .mockResolvedValueOnce(eligibilityRequest())
      .mockResolvedValueOnce(approved);

    renderPage();
    await screen.findByText("Pending");

    act(() =>
      live.refetch?.({ event: "eligibility.decided", data: { id: 8, status: "approved" } }),
    );

    expect(getEligibilityRequest).toHaveBeenCalledTimes(1);

    act(() =>
      live.refetch?.({ event: "eligibility.decided", data: { id: 9, status: "approved" } }),
    );

    expect(await screen.findByText("Approved")).toBeTruthy();
    expect(screen.getByText("You can now pick open requests for these projects.")).toBeTruthy();
    expect(getEligibilityRequest).toHaveBeenCalledTimes(2);
  });
});

describe("EligibilityRequestDetailPage in another language", () => {
  it("shows the request in Czech, with the Czech plural", async () => {
    await i18n.changeLanguage("cs");
    vi.mocked(getEligibilityRequest).mockResolvedValue(eligibilityRequest());

    renderPage();

    expect(await screen.findByRole("heading", { name: "2 projekty" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Žádost o oprávnění" })).toBeTruthy();
    expect(within(card()).getByText("Čeká")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Schválit žádost uživatele Bob" })).toBeTruthy();
  });

  it("labels a decided request in the singular in Spanish", async () => {
    await i18n.changeLanguage("es");
    vi.mocked(getEligibilityRequest).mockResolvedValue(approved);

    renderPage();

    expect(await within(await screen.findByRole("article")).findByText("Aprobada")).toBeTruthy();
    expect(screen.getByText("Revisada por")).toBeTruthy();
    expect(screen.getByText("Nota del Head Tutor")).toBeTruthy();
  });
});
