import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import CouncilPage from "./CouncilPage";

afterEach(() => {
  cleanup();
});

describe("CouncilPage", () => {
  it("invites the user to send an anonymous message", () => {
    render(
      <MemoryRouter>
        <CouncilPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Student Council" })).toBeTruthy();
    expect(screen.getByText(/Send us an anonymous message\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Send a message" }).getAttribute("href")).toBe(
      "/council/send",
    );
  });

  it("explains what happens to a message", () => {
    render(
      <MemoryRouter>
        <CouncilPage />
      </MemoryRouter>,
    );

    const panel = screen.getByRole("heading", { name: "How it works" })
      .parentElement as HTMLElement;

    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Write your messageAn idea, a problem or feedback for the council.",
      "The council reads itCouncil members see the message, never who sent it.",
      "They act on itThey cannot reply to you directly: you stay anonymous.",
    ]);
  });
});
