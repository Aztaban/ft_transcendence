import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import usePageTitle from "./usePageTitle";

afterEach(() => {
  cleanup();
  document.title = "";
});

// The browser tab names the page (WCAG 2.4.2).
describe("usePageTitle", () => {
  it("names the page before the application", () => {
    renderHook(() => usePageTitle("History"));

    expect(document.title).toBe("History · 42 Evals");
  });

  it("follows a new title, e.g. after a language switch", () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "History" },
    });

    rerender({ title: "Historie" });

    expect(document.title).toBe("Historie · 42 Evals");
  });

  it("shows only the application's name without a page title", () => {
    renderHook(() => usePageTitle(""));

    expect(document.title).toBe("42 Evals");
  });
});
