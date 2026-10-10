import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EvaluationRequest, EvaluationRequestStatus } from "../../types/evaluation";
import OpenRequests from "./OpenRequests";

afterEach(() => {
  cleanup();
});

function makeRequest(
  id: number,
  projectName: string,
  status: EvaluationRequestStatus,
): EvaluationRequest {
  const isPicked = status === "awaiting_confirmation" || status === "confirmed";

  return {
    id,
    student: { id: 1, display_name: "Student", avatar_url: null },
    project: { id, slug: projectName, name: projectName },
    note: "",
    status,
    picked_by: isPicked ? { id: 2, display_name: "Hitchhiker", avatar_url: null } : null,
    starts_at: isPicked ? "2026-10-12T15:00:00Z" : null,
    ends_at: isPicked ? "2026-10-12T15:45:00Z" : null,
    cancelled_by: null,
    cancelled_at: status === "cancelled" ? "2026-10-11T10:00:00Z" : null,
    expired_at: status === "expired" ? "2026-10-11T10:00:00Z" : null,
    result: null,
    feedback: "",
    completed_at: null,
    is_history: status === "cancelled" || status === "expired",
    created_at: "2026-10-10T09:00:00Z",
    updated_at: "2026-10-10T09:00:00Z",
  };
}

describe("OpenRequests", () => {
  it("shows the empty state when there are no open requests", () => {
    render(<OpenRequests requests={[]} />);

    expect(screen.getByText("No open requests")).toBeTruthy();
  });

  it("displays pending and awaiting-confirmation requests", () => {
    const requests = [
      makeRequest(1, "ft_transcendence", "pending"),
      makeRequest(2, "webserv", "awaiting_confirmation"),
    ];

    render(<OpenRequests requests={requests} />);

    expect(screen.getByText("ft_transcendence")).toBeTruthy();
    expect(screen.getByText("webserv")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Awaiting confirmation")).toBeTruthy();
  });

  it("does not display confirmed, cancelled or expired requests", () => {
    const requests = [
      makeRequest(1, "confirmed-project", "confirmed"),
      makeRequest(2, "cancelled-project", "cancelled"),
      makeRequest(3, "expired-project", "expired"),
    ];

    render(<OpenRequests requests={requests} />);

    expect(screen.queryByText("confirmed-project")).toBeNull();
    expect(screen.queryByText("cancelled-project")).toBeNull();
    expect(screen.queryByText("expired-project")).toBeNull();
    expect(screen.getByText("No open requests")).toBeTruthy();
  });
});
