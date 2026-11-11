import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import i18n from "../i18n";
import DesignSystemPage from "./DesignSystemPage";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

function renderPage() {
  return render(
    <MemoryRouter>
      <DesignSystemPage />
    </MemoryRouter>,
  );
}

describe("DesignSystemPage", () => {
  it("shows the palette, the type scale, the icons and every component", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Design system" })).toBeTruthy();
    expect(document.title).toBe("Design system · 42 Evals");
    for (const name of ["Colour palette", "Type scale", "Icons", "Components"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }

    const components = screen.getByRole("region", { name: "Components" });
    const names = within(components)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent)
      .join(" · ")
      .split(" · ");

    expect(names).toEqual([
      "Button",
      "Input",
      "Checkbox",
      "Badge",
      "StatusPill",
      "Avatar",
      "Icon",
      "Notice",
      "Tabs",
      "ProgressBar",
      "TextArea",
      "Skeleton",
      "EmptyState",
      "Dialog",
    ]);
  });

  it("opens the example dialog and gives the focus back on close", () => {
    renderPage();

    const opener = screen.getByRole("button", { name: "Open a dialog" });

    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Delete this message?" })).getByRole("button", {
        name: "Close",
      }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("is translated", async () => {
    await i18n.changeLanguage("cs");
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Design systém" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Barevná paleta" })).toBeTruthy();
  });
});
