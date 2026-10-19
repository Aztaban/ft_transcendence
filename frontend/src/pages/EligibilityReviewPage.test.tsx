import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { listEligibilityRequests, reviewEligibilityRequest } from "../api/eligibility";
import { RoleProvider } from "../store/RoleContext";
import type { EligibilityRequest } from "../types/eligibility";
import type { UserProfile } from "../types/user";
import EligibilityReviewPage from "./EligibilityReviewPage";

// The shared /users/me/ store, as loaded for the logged-in Head Tutor.
const currentUser = vi.hoisted(() => ({
  user: null as UserProfile | null,
  roles: [] as string[],
  isLoaded: false,
}));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, refresh: () => {} }),
}));
vi.mock("../api/eligibility", () => ({
  listEligibilityRequests: vi.fn(),
  reviewEligibilityRequest: vi.fn(),
}));

function logIn(roles: string[]) {
  currentUser.user = { id: 1, email: "head@42.cz", display_name: "headtut", language: "en", roles };
  currentUser.roles = roles;
  currentUser.isLoaded = true;
}

function request(id: number, name: string, extra: Partial<EligibilityRequest> = {}) {
  return {
    id,
    requester: { id: id + 10, display_name: name, avatar_url: null },
    projects: [
      { id: 1, slug: "born2beroot", name: "born2beroot" },
      { id: 3, slug: "push_swap", name: "push_swap" },
    ],
    status: "pending" as const,
    reviewed_by: null,
    reviewed_at: null,
    review_note: "",
    created_at: "2026-10-13T08:00:00Z",
    ...extra,
  };
}

function page(results: EligibilityRequest[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

beforeEach(() => {
  logIn(["tutor", "head_tutor"]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  currentUser.user = null;
  currentUser.roles = [];
  currentUser.isLoaded = false;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <EligibilityReviewPage />
      </RoleProvider>
    </MemoryRouter>,
  );
}

describe("EligibilityReviewPage", () => {
  it("lists the pending requests with requester and projects", async () => {
    vi.mocked(listEligibilityRequests).mockResolvedValue(page([request(9, "dkolarov")]));

    renderPage();

    const row = (await screen.findByText("dkolarov")).closest("tr") as HTMLElement;

    expect(listEligibilityRequests).toHaveBeenCalledWith("pending", {
      ordering: undefined,
      page: 1,
    });
    expect(
      within(row)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["born2beroot", "push_swap"]);
    expect(within(row).getByRole("button", { name: "Approve dkolarov's request" })).toBeTruthy();
  });

  it("shows the restricted page without the head_tutor or admin role", async () => {
    logIn(["tutor"]);

    renderPage();

    expect(await screen.findByText("ACCESS RESTRICTED")).toBeTruthy();
    expect(listEligibilityRequests).not.toHaveBeenCalled();
  });

  it("disables the buttons on the user's own request", async () => {
    vi.mocked(listEligibilityRequests).mockResolvedValue(
      page([
        {
          ...request(9, "headtut"),
          requester: { id: 1, display_name: "headtut", avatar_url: null },
        },
      ]),
    );

    renderPage();

    expect(await screen.findByText("Your request")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Approve headtut's request" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("approves with a note and reloads the list", async () => {
    vi.mocked(listEligibilityRequests)
      .mockResolvedValueOnce(page([request(9, "dkolarov")]))
      .mockResolvedValueOnce(page([]));
    vi.mocked(reviewEligibilityRequest).mockResolvedValue(
      request(9, "dkolarov", { status: "approved" }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve dkolarov's request" }));

    const dialog = screen.getByRole("dialog", { name: "Approve dkolarov's request?" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: " Welcome! " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect((await screen.findByRole("status")).textContent).toBe(
      "dkolarov's request was approved.",
    );
    expect(reviewEligibilityRequest).toHaveBeenCalledWith(9, {
      decision: "approved",
      review_note: "Welcome!",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("No pending requests")).toBeTruthy();
  });

  it("declines without a note", async () => {
    vi.mocked(listEligibilityRequests).mockResolvedValue(page([request(9, "dkolarov")]));
    vi.mocked(reviewEligibilityRequest).mockResolvedValue(
      request(9, "dkolarov", { status: "declined" }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Decline dkolarov's request" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Decline" }));

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(reviewEligibilityRequest).toHaveBeenCalledWith(9, { decision: "declined" });
  });

  it("closes the dialog and explains on the page when another Head Tutor was faster", async () => {
    vi.mocked(listEligibilityRequests)
      .mockResolvedValueOnce(page([request(9, "dkolarov")]))
      .mockResolvedValueOnce(page([]));
    vi.mocked(reviewEligibilityRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "eligibility_request_already_reviewed"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve dkolarov's request" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Another Head Tutor already reviewed this request.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("No pending requests")).toBeTruthy();
    expect(listEligibilityRequests).toHaveBeenCalledTimes(2);
    expect(reviewEligibilityRequest).toHaveBeenCalledTimes(1);
  });

  it("keeps other errors inside the dialog", async () => {
    vi.mocked(listEligibilityRequests).mockResolvedValue(page([request(9, "dkolarov")]));
    vi.mocked(reviewEligibilityRequest).mockRejectedValue(
      new ApiError(403, "Forbidden", "cannot_review_own_request"),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Approve dkolarov's request" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));

    const alert = await screen.findByRole("alert");

    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBe(alert);
  });

  it("shows reviewed requests with the decision on the other tabs", async () => {
    vi.mocked(listEligibilityRequests)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(
        page([
          request(9, "dkolarov", {
            status: "approved",
            reviewed_by: { id: 1, display_name: "headtut", avatar_url: null },
            review_note: "Welcome!",
          }),
        ]),
      );

    renderPage();
    await screen.findByText("No pending requests");
    fireEvent.click(screen.getByRole("tab", { name: "Approved" }));

    expect(await screen.findByText("by headtut")).toBeTruthy();
    expect(listEligibilityRequests).toHaveBeenLastCalledWith("approved", {
      ordering: "-created_at",
      page: 1,
    });
    expect(screen.getByText("Welcome!")).toBeTruthy();
  });

  it("loads more reviewed requests, newest first, with Show more", async () => {
    const first = Array.from({ length: 20 }, (_, index) =>
      request(100 + index, `tutor${index}`, { status: "declined" }),
    );

    vi.mocked(listEligibilityRequests).mockImplementation(async (status, options = {}) => {
      if (status === "pending") {
        return page([]);
      }

      return options.page === 2
        ? page([request(1, "oldest", { status: "declined" })], 21)
        : page(first, 21, "https://localhost/api/v1/tutor-eligibility-requests/?page=2");
    });

    renderPage();
    await screen.findByText("No pending requests");
    fireEvent.click(screen.getByRole("tab", { name: "Declined" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));

    expect(await screen.findByText("oldest")).toBeTruthy();
    expect(screen.getByText("tutor0")).toBeTruthy();
    expect(listEligibilityRequests).toHaveBeenLastCalledWith("declined", {
      ordering: "-created_at",
      page: 2,
    });
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("retries the same page when Show more fails", async () => {
    const first = Array.from({ length: 20 }, (_, index) =>
      request(100 + index, `tutor${index}`, { status: "declined" }),
    );
    let failNextPage = true;

    vi.mocked(listEligibilityRequests).mockImplementation(async (status, options = {}) => {
      if (status === "pending") {
        return page([]);
      }

      if (options.page === 2) {
        if (failNextPage) {
          failNextPage = false;
          throw new Error("network");
        }

        return page([request(1, "oldest", { status: "declined" })], 21);
      }

      return page(first, 21, "https://localhost/api/v1/tutor-eligibility-requests/?page=2");
    });

    renderPage();
    await screen.findByText("No pending requests");
    fireEvent.click(screen.getByRole("tab", { name: "Declined" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show more (1 left)" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load more requests. Please try again.",
    );
    expect(screen.getByText("tutor0")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));

    expect(await screen.findByText("oldest")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      vi.mocked(listEligibilityRequests).mock.calls.filter(([, options]) => options?.page === 2),
    ).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });
});
