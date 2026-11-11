import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import StatusPill from "./StatusPill";

afterEach(cleanup);

describe("StatusPill", () => {
  it("shows the translated label in its tone's colours", () => {
    render(<StatusPill tone="success">Approved</StatusPill>);

    expect(screen.getByText("Approved").className).toBe("ui-status-pill ui-status-pill--success");
  });

  it("keeps the page's own classes", () => {
    render(
      <StatusPill tone="danger" className="eligibility-review__status">
        Declined
      </StatusPill>,
    );

    expect(screen.getByText("Declined").className).toBe("eligibility-review__status");
  });
});
