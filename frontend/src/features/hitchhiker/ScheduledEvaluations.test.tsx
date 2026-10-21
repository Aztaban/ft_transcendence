import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { makeRequest } from "../student/testUtils";
import ScheduledEvaluations from "./ScheduledEvaluations";

afterEach(() => {
  cleanup();
});

describe("ScheduledEvaluations", () => {
  it("is titled for each viewer and shows the empty state", () => {
    const { rerender } = render(<ScheduledEvaluations requests={[]} viewer="student" />);

    expect(screen.getByRole("heading", { name: "Pending Evaluations" })).toBeTruthy();
    expect(screen.getByText("Nothing scheduled yet")).toBeTruthy();

    rerender(<ScheduledEvaluations requests={[]} viewer="hitchhiker" />);

    expect(screen.getByRole("heading", { name: "Upcoming Evaluations" })).toBeTruthy();
  });

  it("shows a loading placeholder instead of the empty state while loading", () => {
    render(<ScheduledEvaluations requests={[]} viewer="student" isLoading />);

    expect(screen.getByText("Loading scheduled evaluations…")).toBeTruthy();
    expect(screen.queryByText("Nothing scheduled yet")).toBeNull();
  });

  it("shows the Hitchhiker to a student and the student to a Hitchhiker", () => {
    const requests = [makeRequest(1, "minishell", "confirmed")];
    const { rerender } = render(<ScheduledEvaluations requests={requests} viewer="student" />);

    expect(screen.getByText("minishell")).toBeTruthy();
    expect(screen.getByText("With Hitchhiker")).toBeTruthy();
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-10-12T15:00:00Z");

    rerender(<ScheduledEvaluations requests={requests} viewer="hitchhiker" />);

    expect(screen.getByText("With Student")).toBeTruthy();
  });

  it("shows no student to a Hitchhiker when the API hides it", () => {
    render(
      <ScheduledEvaluations
        requests={[{ ...makeRequest(1, "minishell", "confirmed"), student: null }]}
        viewer="hitchhiker"
      />,
    );

    expect(screen.getByText("minishell")).toBeTruthy();
    expect(screen.queryByText(/^With /)).toBeNull();
  });

  it("does not display open, awaiting, cancelled, expired or past evaluations", () => {
    const requests = [
      makeRequest(1, "pending-project", "pending"),
      makeRequest(2, "awaiting-project", "awaiting_confirmation"),
      makeRequest(3, "cancelled-project", "cancelled"),
      makeRequest(4, "expired-project", "expired"),
      { ...makeRequest(5, "past-project", "confirmed"), is_history: true },
    ];

    render(<ScheduledEvaluations requests={requests} viewer="hitchhiker" />);

    for (const name of [
      "pending-project",
      "awaiting-project",
      "cancelled-project",
      "expired-project",
      "past-project",
    ]) {
      expect(screen.queryByText(name)).toBeNull();
    }
    expect(screen.getByText("Nothing scheduled yet")).toBeTruthy();
  });
});
