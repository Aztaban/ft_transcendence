import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ScrollableList from "./ScrollableList";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderList(contentHeight: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(contentHeight);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(236);

  render(
    <>
      <h2 id="title">History</h2>
      <ScrollableList labelledBy="title">
        <p>A row</p>
      </ScrollableList>
    </>,
  );

  return screen.getByRole("group", { name: "History" });
}

describe("ScrollableList", () => {
  it("is a tab stop when its rows do not fit", () => {
    expect(renderList(500).getAttribute("tabindex")).toBe("0");
  });

  it("is no tab stop when there is nothing to scroll", () => {
    expect(renderList(100).getAttribute("tabindex")).toBeNull();
  });
});
