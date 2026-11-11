import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Skeleton from "./Skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("is busy, says what is loading and shows decorative blocks", () => {
    const { container } = render(<Skeleton label="Loading your requests…" count={3} />);
    const group = container.firstElementChild as HTMLElement;

    expect(group.getAttribute("aria-busy")).toBe("true");
    expect(group.className).toBe("ui-skeleton");
    expect(screen.getByText("Loading your requests…").className).toBe("ui-sr-only");
    expect(group.querySelectorAll(".ui-skeleton__item")).toHaveLength(3);
  });

  it("keeps the page's own classes for the group and the blocks", () => {
    const { container } = render(
      <Skeleton
        label="Loading…"
        className="dashboard-requests"
        itemClassName="dashboard-requests__skeleton"
      />,
    );

    expect((container.firstElementChild as HTMLElement).className).toBe("dashboard-requests");
    expect(container.querySelectorAll(".dashboard-requests__skeleton")).toHaveLength(2);
  });
});
