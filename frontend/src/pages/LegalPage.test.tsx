import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import i18n from "../i18n";
import LegalPage from "./LegalPage";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

function renderPage(kind: "privacy" | "terms") {
  return render(
    <MemoryRouter>
      <LegalPage kind={kind} />
    </MemoryRouter>,
  );
}

function headings() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

describe("LegalPage", () => {
  it("shows the Privacy Policy with its sections and date", () => {
    renderPage("privacy");

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByText("Last updated: 31 October 2026")).toBeTruthy();
    expect(headings()).toEqual([
      "Who runs this application",
      "What we store",
      "Why we use it",
      "Who can see it",
      "Sharing with others",
      "Cookies and browser storage",
      "How long we keep it",
      "Your choices",
      "Security",
      "Changes and contact",
    ]);
    expect(screen.getByText("Notifications are deleted automatically after 90 days.")).toBeTruthy();
  });

  it("shows the Terms of Service with its sections", () => {
    renderPage("terms");

    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeTruthy();
    expect(headings()).toEqual([
      "The service",
      "Your account",
      "Roles",
      "Evaluations",
      "Hitchhiker eligibility",
      "Student Council messages",
      "Acceptable use",
      "Suspension and deletion",
      "No guarantees",
      "Privacy, changes and contact",
    ]);
  });

  it("leads back to the application", () => {
    renderPage("terms");

    const main = screen.getByRole("main");
    const links = within(main).getAllByRole("link", { name: /Back to the application/ });

    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/"]);
  });

  it("follows the chosen language, date included", async () => {
    await i18n.changeLanguage("cs");
    renderPage("privacy");

    expect(
      screen.getByRole("heading", { level: 1, name: "Zásady ochrany osobních údajů" }),
    ).toBeTruthy();
    expect(screen.getByText("Poslední aktualizace: 31. října 2026")).toBeTruthy();
    cleanup();

    await i18n.changeLanguage("es");
    renderPage("terms");

    expect(screen.getByRole("heading", { level: 1, name: "Términos de servicio" })).toBeTruthy();
    expect(screen.getByText("Última actualización: 31 de octubre de 2026")).toBeTruthy();
  });
});
