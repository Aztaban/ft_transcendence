import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { listSCMessages } from "../../api/scMessages";
import type { SCMessage } from "../../types/scMessage";
import { useCouncilMessages } from "./useCouncilMessages";

vi.mock("../../api/scMessages", () => ({ listSCMessages: vi.fn() }));

// `count` messages, newest (highest id) first.
function messages(count: number): SCMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: count - index,
    body: `Message ${count - index}`,
    read_at: null,
    discussion_note: "",
    discussion_note_version: 0,
    created_at: "2026-10-17T08:00:00Z",
  }));
}

// A fake GET /sc-messages/ over `all` (§5.7): DRF answers 404 for a page past the end.
function serve(all: SCMessage[]) {
  vi.mocked(listSCMessages).mockImplementation(async ({ page = 1, pageSize = 20 } = {}) => {
    const start = (page - 1) * pageSize;

    if (page > 1 && start >= all.length) {
      throw new ApiError(404, "Invalid page.", "not_found");
    }

    return {
      count: all.length,
      next: start + pageSize < all.length ? "next" : null,
      previous: null,
      results: all.slice(start, start + pageSize),
    };
  });
}

function requests() {
  return vi.mocked(listSCMessages).mock.calls.map(([params]) => ({
    unread: params?.unread,
    page: params?.page,
    pageSize: params?.pageSize,
  }));
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("useCouncilMessages", () => {
  it("loads the other list when `unread` changes", async () => {
    serve(messages(3));
    const { result, rerender } = renderHook(({ unread }) => useCouncilMessages(unread), {
      initialProps: { unread: true },
    });

    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    rerender({ unread: false });

    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(2));
    expect(requests()).toEqual([
      { unread: true, page: undefined, pageSize: 20 },
      { unread: false, page: undefined, pageSize: 20 },
    ]);
  });

  it("shows nothing of the old list under the new filter, and its error if it fails", async () => {
    serve(messages(30));
    const { result, rerender } = renderHook(({ unread }) => useCouncilMessages(unread), {
      initialProps: { unread: false },
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(20));
    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(30));

    vi.mocked(listSCMessages).mockRejectedValue(new Error("network"));
    rerender({ unread: true });

    // At once: the old 30 messages are gone and the new list is loading.
    expect(result.current.messages).toEqual([]);
    expect(result.current.loadState).toBe("loading");

    await waitFor(() => expect(result.current.loadState).toBe("error"));
    expect(result.current.messages).toEqual([]);
    // The new list starts again at 20, not at the 40 of the old one.
    expect(requests().slice(-1)).toEqual([{ unread: true, page: undefined, pageSize: 20 }]);
  });

  it("adds 20 messages at a time beyond the first 100 too", async () => {
    serve(messages(250));
    const { result } = renderHook(() => useCouncilMessages(false));

    for (const shown of [20, 40, 60, 80, 100]) {
      await waitFor(() => expect(result.current.messages).toHaveLength(shown));
      act(() => result.current.showMore());
    }

    await waitFor(() => expect(result.current.messages).toHaveLength(120));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.total).toBe(250);

    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(140));
    expect(result.current.messages.map(({ id }) => id).slice(-2)).toEqual([112, 111]);
  });

  it("loads pages of 100 beyond the first 100 messages", async () => {
    serve(messages(130));
    const { result } = renderHook(() => useCouncilMessages(false));

    for (const shown of [20, 40, 60, 80, 100, 120]) {
      await waitFor(() => expect(result.current.messages).toHaveLength(shown));
      act(() => result.current.showMore());
    }

    await waitFor(() => expect(result.current.messages).toHaveLength(130));
    expect(requests().slice(-2)).toEqual([
      { unread: false, page: 1, pageSize: 100 },
      { unread: false, page: 2, pageSize: 100 },
    ]);
    expect(result.current.hasMore).toBe(false);
    expect(new Set(result.current.messages.map(({ id }) => id)).size).toBe(130);
  });

  it("loads again when the list got shorter between two pages", async () => {
    const all = messages(130);
    let shrink = false;

    serve(all);
    const { result } = renderHook(() => useCouncilMessages(false));

    for (const shown of [20, 40, 60, 80, 100]) {
      await waitFor(() => expect(result.current.messages).toHaveLength(shown));

      if (shown === 100) {
        // Page 1 of 100 still sees 130 messages; before page 2 is asked, colleagues delete 30,
        // so page 2 is a 404. Loading again then sees 100.
        vi.mocked(listSCMessages).mockImplementation(async ({ page = 1, pageSize = 20 } = {}) => {
          if (page === 2) {
            shrink = true;
            throw new ApiError(404, "Invalid page.", "not_found");
          }

          const count = shrink ? 100 : 130;

          return {
            count,
            next: pageSize < count ? "next" : null,
            previous: null,
            results: all.slice(0, Math.min(pageSize, count)),
          };
        });
      }

      act(() => result.current.showMore());
    }

    await waitFor(() => expect(shrink).toBe(true));
    await waitFor(() => expect(result.current.total).toBe(100));
    expect(result.current.moreFailed).toBe(false);
    expect(result.current.messages).toHaveLength(100);
  });

  it("shows the error after one request when even the first page answers 404", async () => {
    vi.mocked(listSCMessages).mockRejectedValue(new ApiError(404, "Not found.", "not_found"));
    const { result } = renderHook(() => useCouncilMessages(true));

    await waitFor(() => expect(result.current.loadState).toBe("error"));
    // Give a loop the chance to show itself.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(listSCMessages).toHaveBeenCalledTimes(1);
  });

  it("starts again only once when a later page keeps answering 404", async () => {
    const all = messages(130);

    serve(all);
    const { result } = renderHook(() => useCouncilMessages(false));

    for (const shown of [20, 40, 60, 80, 100, 120]) {
      await waitFor(() => expect(result.current.messages).toHaveLength(shown));
      act(() => result.current.showMore());
    }

    await waitFor(() => expect(result.current.messages).toHaveLength(130));

    // A broken backend: page 1 promises more, page 2 never exists.
    vi.mocked(listSCMessages).mockClear();
    vi.mocked(listSCMessages).mockImplementation(async ({ page = 1 } = {}) => {
      if (page === 2) {
        throw new ApiError(404, "Invalid page.", "not_found");
      }

      return { count: 130, next: "next", previous: null, results: all.slice(0, 100) };
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(listSCMessages).toHaveBeenCalledTimes(4));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // page 1, page 2 (404), once more page 1 and page 2 (404), then a normal failed refresh:
    // what is shown stays.
    expect(listSCMessages).toHaveBeenCalledTimes(4);
    expect(result.current.messages).toHaveLength(130);
    expect(result.current.loadState).toBe("ready");
  });
});
