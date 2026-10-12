import { cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { RoleProvider, useRole, type AppRole } from "../store/RoleContext";
import HomePage from "./HomePage";

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
    expect(screen.getByText("Open Requests").closest("a")?.getAttribute("href")).toBe("/requests");
    expect(screen.queryByText("NEED AN EVALUATION?")).toBeNull();
  });
});
