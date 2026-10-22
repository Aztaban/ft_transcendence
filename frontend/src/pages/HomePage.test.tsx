import { cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { RoleProvider, useRole, type AppRole } from "../store/RoleContext";
import HomePage from "./HomePage";

// What the mocked hooks report; each test may change it before rendering.
const load = vi.hoisted(() => ({ isLoading: false, hasError: false }));

// The student boxes load data from the API; that is tested in OpenRequests and the hook itself.
vi.mock("../features/hitchhiker/useHitchhikerRequests", () => ({
  useHitchhikerRequests: () => ({ openRequests: [], pickedRequests: [], ...load }),
}));
vi.mock("../features/student/useStudentRequests", () => ({
  useStudentRequests: () => ({ requests: [], ...load, reload: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  // The active workspace is kept for the tab; each test starts as a student.
  sessionStorage.clear();
  load.isLoading = false;
  load.hasError = false;
});

// Switches the active role, as the role selector in the sidebar does.
function SwitchRole({ role }: { role: AppRole }) {
  const { setActiveRole } = useRole();

  useEffect(() => {
    setActiveRole(role);
  }, [role, setActiveRole]);

  return null;
}

function renderHomeAs(role: AppRole) {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <SwitchRole role={role} />
        <HomePage />
      </RoleProvider>
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  it("shows the student call to action for students", () => {
    renderHomeAs("STUDENT");

    expect(screen.getByText("NEED AN EVALUATION?")).toBeTruthy();
    expect(screen.getByText("Student")).toBeTruthy();
    expect(document.title).toBe("Home · 42 Evals");
  });

  it("shows the Hitchhiker dashboard for Hitchhikers", () => {
    renderHomeAs("HITCHHIKER");

    expect(screen.getByText("READY TO EVALUATE?")).toBeTruthy();
    expect(screen.getByText("Hitchhiker")).toBeTruthy();
    expect(screen.getByText("Open requests")).toBeTruthy();
    expect(screen.getByText("Awaiting confirmation")).toBeTruthy();
    expect(screen.getByText("Open Requests", { selector: "a" }).getAttribute("href")).toBe(
      "/requests",
    );
    expect(screen.queryByText("NEED AN EVALUATION?")).toBeNull();
  });

  it("shows the four Hitchhiker sections instead of the placeholders", () => {
    renderHomeAs("HITCHHIKER");

    for (const title of [
      "Open Requests",
      "Awaiting Confirmation",
      "Upcoming Evaluations",
      "History",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
    }
    expect(screen.queryByText("No history yet")).toBeTruthy();
    expect(screen.queryByText("Your recent activity will appear here.")).toBeNull();
  });

  it("shows skeletons instead of empty states while the student's requests load", () => {
    load.isLoading = true;
    renderHomeAs("STUDENT");

    expect(screen.getByText("Loading your requests…")).toBeTruthy();
    expect(screen.getByText("Loading scheduled evaluations…")).toBeTruthy();
    expect(screen.getByText("Loading your history…")).toBeTruthy();
    expect(screen.queryByText("No open requests")).toBeNull();
  });

  it("shows skeletons in all four Hitchhiker boxes while loading", () => {
    load.isLoading = true;
    renderHomeAs("HITCHHIKER");

    expect(screen.getByText("Loading open requests…")).toBeTruthy();
    expect(screen.getByText("Loading proposed slots…")).toBeTruthy();
    expect(screen.getByText("Loading scheduled evaluations…")).toBeTruthy();
    expect(screen.getByText("Loading your history…")).toBeTruthy();
  });

  it("shows only the error when the first load fails, without empty states", () => {
    load.hasError = true;
    renderHomeAs("HITCHHIKER");

    expect(screen.getByRole("alert").textContent).toBe(
      "Could not load your requests. Please try again later.",
    );
    expect(screen.queryByText("No open requests")).toBeNull();
    expect(screen.queryByText("No history yet")).toBeNull();
  });
});

describe("HomePage in another language", () => {
  it("shows the student dashboard in Czech", async () => {
    await i18n.changeLanguage("cs");
    renderHomeAs("STUDENT");

    expect(screen.getByRole("heading", { name: "Vítejte zpět" })).toBeTruthy();
    expect(document.title).toBe("Domů · 42 Evals");
    expect(screen.getByText("POTŘEBUJETE HODNOCENÍ?")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Otevřené žádosti" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Čekající hodnocení" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Nová žádost/ })).toBeTruthy();
  });
});
