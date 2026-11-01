import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { countPeople } from "../../api/people";
import { listSCMessages } from "../../api/scMessages";
import type { SCMessage } from "../../types/scMessage";
import { useCouncilOverview } from "./useCouncilOverview";

vi.mock("../../api/people", () => ({ countPeople: vi.fn() }));
vi.mock("../../api/scMessages", () => ({ listSCMessages: vi.fn() }));

const currentUser = vi.hoisted(() => ({ roles: ["student", "sc_member"], isLoaded: true }));

vi.mock("../../store/CurrentUserContext", () => ({ useCurrentUser: () => currentUser }));

const message: SCMessage = {
  id: 4,
  body: "Quiet study areas, please.",
  read_at: null,
  discussion_note: "",
  discussion_note_version: 0,
  created_at: "2026-10-17T08:00:00Z",
};

function page(results: SCMessage[], count = results.length) {
  return { count, next: null, previous: null, results };
}

beforeEach(() => {
  vi.mocked(listSCMessages).mockImplementation(async ({ unread } = {}) =>
    unread ? page([message], 1) : page([message], 5),
  );
  vi.mocked(countPeople).mockResolvedValue(9);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  currentUser.roles = ["student", "sc_member"];
  currentUser.isLoaded = true;
});

describe("useCouncilOverview", () => {
  it("reads the real totals", async () => {
    const { result } = renderHook(() => useCouncilOverview());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.unread).toEqual([message]);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.totalCount).toBe(5);
    await waitFor(() => expect(result.current.hitchhikerCount).toBe(9));
  });

  it("keeps the messages when only the Hitchhiker count fails", async () => {
    vi.mocked(countPeople).mockRejectedValue(new Error("throttled"));

    const { result } = renderHook(() => useCouncilOverview());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasError).toBe(false);
    expect(result.current.unread).toEqual([message]);
    expect(result.current.hitchhikerCount).toBeNull();
  });

  it("reports the error when the messages cannot be loaded", async () => {
    vi.mocked(listSCMessages).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useCouncilOverview());

    await waitFor(() => expect(result.current.hasError).toBe(true));
  });

  it("loads again when the tab is shown", async () => {
    const { result } = renderHook(() => useCouncilOverview());

    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    vi.mocked(listSCMessages).mockImplementation(async ({ unread } = {}) =>
      unread ? page([], 0) : page([message], 5),
    );
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it("asks for nothing until the user's role is confirmed", async () => {
    currentUser.isLoaded = false;

    const { rerender } = renderHook(() => useCouncilOverview());

    expect(listSCMessages).not.toHaveBeenCalled();

    currentUser.isLoaded = true;
    currentUser.roles = ["student"];
    rerender();

    expect(listSCMessages).not.toHaveBeenCalled();
    expect(countPeople).not.toHaveBeenCalled();
  });
});
