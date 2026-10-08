import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import OpenRequests from "./OpenRequests";
import { makeRequest } from "./testUtils";

afterEach(() => {
  cleanup();
});

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
    expect(screen.getByText("Needs your confirmation")).toBeTruthy();
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

  it("highlights requests awaiting confirmation with the proposed slot", () => {
    const requests = [
      makeRequest(1, "ft_transcendence", "pending"),
      makeRequest(2, "webserv", "awaiting_confirmation"),
    ];

    render(<OpenRequests requests={requests} />);

    const awaitingCard = screen.getByText("webserv").closest("article");
    const pendingCard = screen.getByText("ft_transcendence").closest("article");

    expect(awaitingCard?.classList.contains("dashboard-request--needs-confirmation")).toBe(true);
    expect(pendingCard?.classList.contains("dashboard-request--needs-confirmation")).toBe(false);
    expect(screen.getByText("Hitchhiker proposed")).toBeTruthy();
    expect(awaitingCard?.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-10-12T15:00:00Z",
    );
  });

  it("lists requests awaiting confirmation first", () => {
    const requests = [
      makeRequest(1, "ft_transcendence", "pending"),
      makeRequest(2, "webserv", "awaiting_confirmation"),
    ];

    render(<OpenRequests requests={requests} />);

    const titles = screen.getAllByRole("heading", { level: 3 }).map((title) => title.textContent);

    expect(titles).toEqual(["webserv", "ft_transcendence"]);
  });
});
