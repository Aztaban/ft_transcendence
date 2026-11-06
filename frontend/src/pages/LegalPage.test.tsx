import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import i18n from "../i18n";
import LegalPage from "./LegalPage";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

function renderPage(kind: "privacy" | "terms", standalone = true) {
  return render(
    <MemoryRouter>
      <LegalPage kind={kind} standalone={standalone} />
    </MemoryRouter>,
  );
}

function headings() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

describe("LegalPage", () => {
  it("shows the Privacy Policy with its sections and date", () => {
    renderPage("privacy");

    expect(document.title).toBe("Privacy Policy · 42 Evals");
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByText("Last updated: 1 November 2026")).toBeTruthy();
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

  it("leads back to the application and names its logo link", () => {
    renderPage("terms");

    const main = within(screen.getByRole("main"));

    expect(main.getByRole("link", { name: "42 EVALS" }).getAttribute("href")).toBe("/");
    expect(main.getByRole("link", { name: "Back to the application" }).getAttribute("href")).toBe(
      "/",
    );
  });

  it("leaves the logo, language and way back to the application shell", () => {
    renderPage("privacy", false);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
  });

  it("opens at its title, also when moving between the two documents", () => {
    document.documentElement.scrollTop = 900;

    const { rerender } = renderPage("privacy");

    expect(document.documentElement.scrollTop).toBe(0);

    document.documentElement.scrollTop = 900;
    rerender(
      <MemoryRouter>
        <LegalPage kind="terms" standalone />
      </MemoryRouter>,
    );

    expect(document.documentElement.scrollTop).toBe(0);
  });

  it("says who can really see what", () => {
    renderPage("privacy");

    expect(screen.getByText(/your 42 login until you change it/)).toBeTruthy();
    expect(screen.getByText(/Head Tutors are the exception/)).toBeTruthy();
    expect(screen.getByText(/Student Council members and Administrators can read/)).toBeTruthy();
    expect(screen.queryByText(/42 login and language stay private/)).toBeNull();
  });

  it("follows the chosen language, date included", async () => {
    await i18n.changeLanguage("cs");
    renderPage("privacy");

    expect(
      screen.getByRole("heading", { level: 1, name: "Zásady ochrany osobních údajů" }),
    ).toBeTruthy();
    expect(screen.getByText("Poslední aktualizace: 1. listopadu 2026")).toBeTruthy();
    cleanup();

    await i18n.changeLanguage("es");
    renderPage("terms");

    expect(screen.getByRole("heading", { level: 1, name: "Términos de servicio" })).toBeTruthy();
    expect(screen.getByText("Última actualización: 1 de noviembre de 2026")).toBeTruthy();
  });
});
