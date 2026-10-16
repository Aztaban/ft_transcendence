import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTutorEligibility, listEligibilityRequests } from "../../api/eligibility";
import { listProjects } from "../../api/projects";
import { RoleProvider, useRole } from "../../store/RoleContext";
import HitchhikerOnboarding from "./HitchhikerOnboarding";

// A Hitchhiker with no eligibility and no pending request: the popup should open.
vi.mock("../../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    user: { id: 2, email: "dkolarov@42.cz", display_name: "dkolarov", language: "en", roles: [] },
    roles: ["student", "tutor"],
    isLoaded: true,
    refresh: () => {},
  }),
}));
vi.mock("../../api/eligibility", () => ({
  getTutorEligibility: vi.fn(),
  listEligibilityRequests: vi.fn(),
  createEligibilityRequest: vi.fn(),
}));
vi.mock("../../api/projects", () => ({ listProjects: vi.fn() }));

beforeEach(() => {
  vi.mocked(getTutorEligibility).mockResolvedValue([]);
  vi.mocked(listEligibilityRequests).mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  vi.mocked(listProjects).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function Controls() {
  const { setActiveRole } = useRole();
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => setActiveRole("HITCHHIKER")}>
        switch
      </button>
      <button type="button" onClick={() => navigate("/eligibility-requests/new")}>
        open the form
      </button>
      <button type="button" onClick={() => navigate("/requests")}>
        go to requests
      </button>
    </>
  );
}

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/requests"]}>
      <RoleProvider>
        <Controls />
        <HitchhikerOnboarding />
      </RoleProvider>
    </MemoryRouter>,
  );
}

describe("HitchhikerOnboarding", () => {
  it("opens the welcome popup in the Hitchhiker workspace", async () => {
    renderOnboarding();

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(await screen.findByRole("heading", { name: "Welcome Hitchhiker" })).toBeTruthy();
  });

  it("does not open it again after the user opened the full form", async () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    await screen.findByRole("heading", { name: "Welcome Hitchhiker" });

    // The request is sent (or not) on the full page, then the user goes back to Requests.
    fireEvent.click(screen.getByRole("button", { name: "open the form" }));
    fireEvent.click(screen.getByRole("button", { name: "go to requests" }));

    expect(screen.queryByRole("heading", { name: "Welcome Hitchhiker" })).toBeNull();
  });
});
