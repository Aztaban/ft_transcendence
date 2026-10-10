import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { makeRequest } from "../student/testUtils";
import AwaitingConfirmation from "./AwaitingConfirmation";

afterEach(() => {
  cleanup();
});

describe("AwaitingConfirmation", () => {
  it("shows the empty state when nothing is waiting", () => {
    render(<AwaitingConfirmation requests={[]} />);

    expect(screen.getByText("Nothing waiting")).toBeTruthy();
  });

  it("displays proposed slots waiting for the student", () => {
    render(
      <AwaitingConfirmation
        requests={[makeRequest(1, "Born to be root", "awaiting_confirmation")]}
      />,
    );

    expect(screen.getByText("Born to be root")).toBeTruthy();
    expect(screen.getByText("Proposed to Student")).toBeTruthy();
    expect(screen.getByText("Waiting for student")).toBeTruthy();
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-10-12T15:00:00Z");
  });

  it("does not display requests in other states", () => {
    const requests = [
      makeRequest(1, "pending-project", "pending"),
      makeRequest(2, "confirmed-project", "confirmed"),
      makeRequest(3, "cancelled-project", "cancelled"),
      makeRequest(4, "expired-project", "expired"),
    ];

    render(<AwaitingConfirmation requests={requests} />);

    expect(screen.queryByText("pending-project")).toBeNull();
    expect(screen.queryByText("confirmed-project")).toBeNull();
    expect(screen.queryByText("cancelled-project")).toBeNull();
    expect(screen.queryByText("expired-project")).toBeNull();
    expect(screen.getByText("Nothing waiting")).toBeTruthy();
  });
});
