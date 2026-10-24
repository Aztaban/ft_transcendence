import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";

import { announceReadChange, useReadChanges } from "./readSync";

// Another tab of the same browser: its own channel with the same name.
const otherTab = new BroadcastChannel("notifications");

afterEach(() => {
  otherTab.onmessage = null;
});

afterAll(() => {
  otherTab.close();
});

describe("readSync", () => {
  test("tells the other tabs that notifications were marked as read", async () => {
    const heard = vi.fn();

    otherTab.onmessage = (event) => heard(event.data);

    announceReadChange();

    await waitFor(() => expect(heard).toHaveBeenCalledWith("read"));
  });

  test("calls back when another tab marked notifications as read, until unmounted", async () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useReadChanges(onChange));

    otherTab.postMessage("read");

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    unmount();
    otherTab.postMessage("read");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
