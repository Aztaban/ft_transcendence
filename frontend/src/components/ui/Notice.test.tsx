import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Notice from "./Notice";

afterEach(cleanup);

describe("Notice", () => {
  it("is a note inside the page by default, not a landmark of its own", () => {
    render(<Notice icon="i">The Hitchhiker evaluation must be the last one.</Notice>);

    expect(screen.getByRole("note").textContent).toContain(
      "The Hitchhiker evaluation must be the last one.",
    );
    expect(screen.getByRole("note").className).toBe("ui-notice ui-notice--info");
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it.each([
    ["error", "alert"],
    ["success", "status"],
    ["warning", "note"],
  ] as const)("is announced as %s with role %s", (tone, role) => {
    render(<Notice tone={tone}>Saved.</Notice>);

    expect(screen.getByRole(role).className).toBe(`ui-notice ui-notice--${tone}`);
  });

  it("hides its sign from screen readers and keeps the page's own class", () => {
    const { container } = render(
      <Notice icon="i" className="info-notice">
        Read this.
      </Notice>,
    );

    expect(container.querySelector(".ui-notice__icon")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("note").className).toBe("info-notice");
  });
});
