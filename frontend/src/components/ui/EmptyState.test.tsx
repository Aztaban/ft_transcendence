import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import EmptyState from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("says what is missing with a heading and a text, its sign hidden from screen readers", () => {
    const { container } = render(
      <EmptyState icon="—" title="No history yet" text="Your evaluations will appear here." />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "No history yet" })).toBeTruthy();
    expect(screen.getByText("Your evaluations will appear here.")).toBeTruthy();
    expect(container.querySelector(".ui-empty-state__icon")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("fits the page's outline and keeps the page's own classes", () => {
    const { container } = render(
      <EmptyState
        headingLevel={2}
        title="Nothing here"
        className="dashboard-empty"
        icon="—"
        iconClassName="dashboard-empty__history-mark"
        action={<a href="/requests">Create a request</a>}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Nothing here" })).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).className).toBe("dashboard-empty");
    expect(container.querySelector(".dashboard-empty__history-mark")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a request" })).toBeTruthy();
  });
});
