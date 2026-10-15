import { cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleProvider, useRole, type AppRole } from "../store/RoleContext";
import HomePage from "./HomePage";

// The student boxes load data from the API; that is tested in OpenRequests and the hook itself.
vi.mock("../features/hitchhiker/useHitchhikerRequests", () => ({
  useHitchhikerRequests: () => ({ openRequests: [], pickedRequests: [], hasError: false }),
}));
vi.mock("../features/student/useStudentRequests", () => ({
  useStudentRequests: () => ({ requests: [], hasError: false, reload: vi.fn() }),
}));

afterEach(() => {
  cleanup();
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
});
