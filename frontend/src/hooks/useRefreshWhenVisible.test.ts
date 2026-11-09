import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import useRefreshWhenVisible from "./useRefreshWhenVisible";

function showTab(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  cleanup();
  // Back to jsdom's own value.
  delete (document as { visibilityState?: unknown }).visibilityState;
});

describe("useRefreshWhenVisible", () => {
  it("refreshes when the tab is shown again, not when it is hidden", () => {
    const refresh = vi.fn();

    renderHook(() => useRefreshWhenVisible(refresh));

    showTab("hidden");
    expect(refresh).not.toHaveBeenCalled();

    showTab("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the page is left", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useRefreshWhenVisible(refresh));

    unmount();
    showTab("visible");

    expect(refresh).not.toHaveBeenCalled();
  });
});
