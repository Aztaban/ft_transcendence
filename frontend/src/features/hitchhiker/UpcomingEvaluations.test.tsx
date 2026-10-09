import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { makeRequest } from "../student/testUtils";
import UpcomingEvaluations from "./UpcomingEvaluations";

afterEach(() => {
  cleanup();
});

describe("UpcomingEvaluations", () => {
  it("shows the empty state when nothing is scheduled", () => {
    render(<UpcomingEvaluations requests={[]} />);

    expect(screen.getByText("Nothing scheduled yet")).toBeTruthy();
  });

  it("displays confirmed evaluations with the student and the slot", () => {
    render(<UpcomingEvaluations requests={[makeRequest(1, "minishell", "confirmed")]} />);

    expect(screen.getByText("minishell")).toBeTruthy();
    expect(screen.getByText("With Student")).toBeTruthy();
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-10-12T15:00:00Z");
  });

  it("does not display open, awaiting, cancelled, expired or past evaluations", () => {
    const requests = [
      makeRequest(1, "pending-project", "pending"),
      makeRequest(2, "awaiting-project", "awaiting_confirmation"),
      makeRequest(3, "cancelled-project", "cancelled"),
      makeRequest(4, "expired-project", "expired"),
      { ...makeRequest(5, "past-project", "confirmed"), is_history: true },
    ];

    render(<UpcomingEvaluations requests={requests} />);

    expect(screen.queryByText("pending-project")).toBeNull();
    expect(screen.queryByText("awaiting-project")).toBeNull();
    expect(screen.queryByText("cancelled-project")).toBeNull();
    expect(screen.queryByText("expired-project")).toBeNull();
    expect(screen.queryByText("past-project")).toBeNull();
    expect(screen.getByText("Nothing scheduled yet")).toBeTruthy();
  });
});
