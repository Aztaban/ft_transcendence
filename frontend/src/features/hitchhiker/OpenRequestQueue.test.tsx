import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { makeRequest } from "../student/testUtils";
import OpenRequestQueue from "./OpenRequestQueue";

afterEach(() => {
  cleanup();
});

describe("OpenRequestQueue", () => {
  it("shows the empty state when there are no open requests", () => {
    render(<OpenRequestQueue requests={[]} />);

    expect(screen.getByText("No open requests")).toBeTruthy();
  });

  it("displays pending requests with the student, when they were requested and the note", () => {
    const requests = [
      { ...makeRequest(1, "libft", "pending"), note: "Need help with parsing." },
      makeRequest(2, "webserv", "pending"),
    ];

    render(<OpenRequestQueue requests={requests} />);

    expect(screen.getByText("libft")).toBeTruthy();
    expect(screen.getByText("webserv")).toBeTruthy();
    expect(screen.getAllByText(/^Student · Requested /)).toHaveLength(2);
    expect(screen.getByText("Need help with parsing.")).toBeTruthy();
    expect(screen.getAllByText("Open")).toHaveLength(2);
  });

  it("does not display requests that are no longer open", () => {
    const requests = [
      makeRequest(1, "awaiting-project", "awaiting_confirmation"),
      makeRequest(2, "confirmed-project", "confirmed"),
      makeRequest(3, "cancelled-project", "cancelled"),
      makeRequest(4, "expired-project", "expired"),
    ];

    render(<OpenRequestQueue requests={requests} />);

    expect(screen.queryByText("awaiting-project")).toBeNull();
    expect(screen.queryByText("confirmed-project")).toBeNull();
    expect(screen.queryByText("cancelled-project")).toBeNull();
    expect(screen.queryByText("expired-project")).toBeNull();
    expect(screen.getByText("No open requests")).toBeTruthy();
  });
});
