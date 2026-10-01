import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import OpenRequests, { type EvaluationRequest } from "./OpenRequests";

afterEach(() => {
  cleanup();
});

describe("OpenRequests", () => {
  it("shows the empty state when there are no open requests", () => {
    render(<OpenRequests requests={[]} />);

    expect(screen.getByText("No open requests")).toBeTruthy();
  });

  it("displays pending and awaiting-confirmation requests", () => {
    const requests: EvaluationRequest[] = [
      { id: 1, projectName: "ft_transcendence", status: "PENDING" },
      { id: 2, projectName: "webserv", status: "AWAITING_CONFIRMATION" },
    ];

    render(<OpenRequests requests={requests} />);

    expect(screen.getByText("ft_transcendence")).toBeTruthy();
    expect(screen.getByText("webserv")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Awaiting confirmation")).toBeTruthy();
  });

  it("does not display confirmed or cancelled requests", () => {
    const requests: EvaluationRequest[] = [
      { id: 1, projectName: "confirmed-project", status: "CONFIRMED" },
      { id: 2, projectName: "cancelled-project", status: "CANCELLED" },
    ];

    render(<OpenRequests requests={requests} />);

    expect(screen.queryByText("confirmed-project")).toBeNull();
    expect(screen.queryByText("cancelled-project")).toBeNull();
    expect(screen.getByText("No open requests")).toBeTruthy();
  });
});
