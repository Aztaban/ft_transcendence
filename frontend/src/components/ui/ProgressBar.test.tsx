import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ProgressBar from "./ProgressBar";

afterEach(cleanup);

describe("ProgressBar", () => {
  it("tells screen readers its name and value, and fills value / max", () => {
    const { container } = render(
      <ProgressBar label="Request progress" value={2} min={1} max={4} />,
    );
    const bar = screen.getByRole("progressbar", { name: "Request progress" });

    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect((container.querySelector("span") as HTMLElement).style.width).toBe("50%");
    expect(bar.className).toBe("ui-progress");
  });

  it("never fills past the ends", () => {
    const { container } = render(<ProgressBar label="Level" value={140} className="level-bar" />);

    expect((container.querySelector("span") as HTMLElement).style.width).toBe("100%");
    expect(screen.getByRole("progressbar").className).toBe("level-bar");
  });
});
