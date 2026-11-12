import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Badge from "./Badge";

afterEach(cleanup);

describe("Badge", () => {
  it("is neutral unless another variant is chosen", () => {
    render(<Badge>Draft</Badge>);

    expect(screen.getByText("Draft").className).toBe("ui-badge ui-badge--neutral");
  });

  it.each(["accent", "success", "warning"] as const)("takes the %s variant", (variant) => {
    render(<Badge variant={variant}>New</Badge>);

    expect(screen.getByText("New").className).toBe(`ui-badge ui-badge--${variant}`);
  });

  // The colour alone carries no meaning: the text is always there (WCAG 1.4.1).
  it("shows its text and keeps extra classes and attributes", () => {
    render(
      <Badge className="extra" title="Added this week">
        New
      </Badge>,
    );

    const badge = screen.getByText("New");

    expect(badge.className).toBe("ui-badge ui-badge--neutral extra");
    expect(badge.getAttribute("title")).toBe("Added this week");
  });
});
