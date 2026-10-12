import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PendingEvaluations from "./PendingEvaluations";
import { makeRequest } from "./testUtils";

afterEach(() => {
  cleanup();
});

describe("PendingEvaluations", () => {
  it("shows the empty state when there are no confirmed evaluations", () => {
    render(<PendingEvaluations requests={[]} />);

    expect(screen.getByText("Nothing scheduled yet")).toBeTruthy();
  });

  it("displays upcoming confirmed evaluations with the Hitchhiker and slot", () => {
    render(<PendingEvaluations requests={[makeRequest(1, "libft", "confirmed")]} />);

    expect(screen.getByText("libft")).toBeTruthy();
    expect(screen.getByText("With Hitchhiker")).toBeTruthy();
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-10-12T15:00:00Z");
  });

  it("does not display open, cancelled, expired or past evaluations", () => {
    const requests = [
      makeRequest(1, "pending-project", "pending"),
      makeRequest(2, "awaiting-project", "awaiting_confirmation"),
      makeRequest(3, "cancelled-project", "cancelled"),
      makeRequest(4, "expired-project", "expired"),
      { ...makeRequest(5, "past-project", "confirmed"), is_history: true },
    ];

    render(<PendingEvaluations requests={requests} />);

    expect(screen.queryByText("pending-project")).toBeNull();
    expect(screen.queryByText("awaiting-project")).toBeNull();
    expect(screen.queryByText("cancelled-project")).toBeNull();
    expect(screen.queryByText("expired-project")).toBeNull();
    expect(screen.queryByText("past-project")).toBeNull();
    expect(screen.getByText("Nothing scheduled yet")).toBeTruthy();
  });
});
