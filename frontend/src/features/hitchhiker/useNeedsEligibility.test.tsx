import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getTutorEligibility, listEligibilityRequests } from "../../api/eligibility";
import type { UserProfile } from "../../types/user";
import useNeedsEligibility from "./useNeedsEligibility";

// The shared /users/me/ store: `user` stays null until the session check and /users/me/ answer.
const currentUser = vi.hoisted(() => ({ user: null as UserProfile | null, roles: [] as string[] }));

vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    ...currentUser,
    isLoaded: currentUser.user !== null,
    refresh: () => {},
  }),
}));
vi.mock("../../api/eligibility", () => ({
  getTutorEligibility: vi.fn(),
  listEligibilityRequests: vi.fn(),
}));

function logIn(roles: string[]) {
  currentUser.user = {
    id: 2,
    email: "dkolarov@42.cz",
    display_name: "dkolarov",
    language: "en",
    roles,
  };
  currentUser.roles = roles;
}

const noRequests = { count: 0, next: null, previous: null, results: [] };
const pendingRequest = {
  id: 9,
  requester: { id: 2, display_name: "dkolarov", avatar_url: null },
  projects: [{ id: 4, slug: "push_swap", name: "push_swap" }],
  status: "pending" as const,
  reviewed_by: null,
  reviewed_at: null,
  review_note: "",
  created_at: "2026-10-13T08:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  currentUser.user = null;
  currentUser.roles = [];
});

describe("useNeedsEligibility", () => {
  it("is true for a Hitchhiker with no eligibility and no pending request", async () => {
    logIn(["student", "tutor"]);
    vi.mocked(getTutorEligibility).mockResolvedValue([]);
    vi.mocked(listEligibilityRequests).mockResolvedValue(noRequests);

    const { result } = renderHook(() => useNeedsEligibility(true));

    await waitFor(() => expect(result.current.needsEligibility).toBe(true));
    expect(getTutorEligibility).toHaveBeenCalledWith(2);
    expect(listEligibilityRequests).toHaveBeenCalledWith("pending");
  });

  it("does not check anything outside the Hitchhiker workspace", () => {
    logIn(["student", "tutor"]);

    const { result } = renderHook(() => useNeedsEligibility(false));

    expect(result.current.needsEligibility).toBe(false);
    expect(getTutorEligibility).not.toHaveBeenCalled();
    expect(listEligibilityRequests).not.toHaveBeenCalled();
  });

  it("waits for /users/me/ before checking", async () => {
    vi.mocked(getTutorEligibility).mockResolvedValue([]);
    vi.mocked(listEligibilityRequests).mockResolvedValue(noRequests);

    const { result, rerender } = renderHook(() => useNeedsEligibility(true));

    expect(getTutorEligibility).not.toHaveBeenCalled();

    logIn(["tutor"]);
    rerender();

    await waitFor(() => expect(result.current.needsEligibility).toBe(true));
    expect(getTutorEligibility).toHaveBeenCalledWith(2);
  });

  it("is false without the tutor or head_tutor role", () => {
    logIn(["student"]);

    const { result } = renderHook(() => useNeedsEligibility(true));

    expect(result.current.needsEligibility).toBe(false);
    expect(getTutorEligibility).not.toHaveBeenCalled();
    expect(listEligibilityRequests).not.toHaveBeenCalled();
  });

  it("is false when the Hitchhiker is already eligible", async () => {
    logIn(["head_tutor"]);
    vi.mocked(getTutorEligibility).mockResolvedValue([
      { id: 4, slug: "push_swap", name: "push_swap" },
    ]);
    vi.mocked(listEligibilityRequests).mockResolvedValue(noRequests);

    const { result } = renderHook(() => useNeedsEligibility(true));

    await waitFor(() => expect(listEligibilityRequests).toHaveBeenCalled());
    expect(result.current.needsEligibility).toBe(false);
  });

  it("is false when a request is already pending", async () => {
    logIn(["tutor"]);
    vi.mocked(getTutorEligibility).mockResolvedValue([]);
    vi.mocked(listEligibilityRequests).mockResolvedValue({
      ...noRequests,
      count: 1,
      results: [pendingRequest],
    });

    const { result } = renderHook(() => useNeedsEligibility(true));

    await waitFor(() => expect(listEligibilityRequests).toHaveBeenCalled());
    expect(result.current.needsEligibility).toBe(false);
  });
});
