import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getTutorEligibility } from "../api/eligibility";
import { listEvaluationRequests } from "../api/evaluationRequests";
import { listProjects } from "../api/projects";
import { getPublicUser } from "../api/users";
import { makeRequest } from "../features/student/testUtils";
import type { EvaluationRequest } from "../types/evaluation";
import type { PublicUser } from "../types/people";
import PersonProfilePage from "./PersonProfilePage";

const session = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));
const workspace = vi.hoisted(() => ({ activeRole: "STUDENT" }));
const me = vi.hoisted(() => ({ id: 1 }));

vi.mock("../api/users", () => ({ getPublicUser: vi.fn() }));
vi.mock("../api/eligibility", () => ({ getTutorEligibility: vi.fn() }));
vi.mock("../api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("../store/AuthContext", () => ({ useAuth: () => session }));
vi.mock("../store/RoleContext", () => ({ useRole: () => workspace }));
vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ user: { id: me.id }, roles: [], isLoaded: true, refresh: () => {} }),
}));

const lenka: PublicUser = {
  id: 7,
  display_name: "Lenka Husarova",
  avatar_url: null,
  roles: [
    { id: 1, name: "student" },
    { id: 3, name: "head_tutor" },
    { id: 4, name: "sc_member" },
  ],
};

const born2beroot = { id: 1, slug: "born2beroot", name: "born2beroot" };
const pushSwap = { id: 2, slug: "push_swap", name: "push_swap" };
const minishell = { id: 3, slug: "minishell", name: "minishell" };
const cpp09 = { id: 4, slug: "cpp09", name: "cpp09" };

// One of the student's requests that Lenka (7) picked, or someone else did.
function withLenka(request: EvaluationRequest, pickedBy = 7): EvaluationRequest {
  return { ...request, picked_by: { id: pickedBy, display_name: "Someone", avatar_url: null } };
}

function page(results: EvaluationRequest[]) {
  return { count: results.length, next: null, previous: null, results };
}

beforeEach(() => {
  vi.mocked(getPublicUser).mockResolvedValue(lenka);
  vi.mocked(getTutorEligibility).mockResolvedValue([born2beroot, pushSwap]);
  vi.mocked(listProjects).mockResolvedValue([born2beroot, cpp09, minishell, pushSwap]);
  vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));
});

afterEach(() => {
  session.isAuthenticated = true;
  session.isLoading = false;
  workspace.activeRole = "STUDENT";
  me.id = 1;
  cleanup();
  vi.resetAllMocks();
});

function renderPage(entries = ["/people/7"]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/people/:id" element={<PersonProfilePage />} />
        <Route path="/hitchhikers" element={<div>Hitchhikers page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function findProfile() {
  return screen.findByRole("heading", { name: "Lenka Husarova", level: 1 });
}

function texts(container: HTMLElement, role: "listitem" | "heading") {
  return within(container)
    .getAllByRole(role)
    .map((item) => item.textContent);
}

describe("PersonProfilePage", () => {
  it("shows the banner: name, roles and how many projects they can evaluate", async () => {
    renderPage();
    await findProfile();

    expect(getPublicUser).toHaveBeenCalledWith(7);
    expect(screen.getByText("LH")).toBeTruthy();
    expect(screen.getByText("42 Prague")).toBeTruthy();
    expect(texts(screen.getByRole("list", { name: "Roles" }), "listitem")).toEqual([
      "Head Tutor",
      "Student Council",
    ]);

    expect(await screen.findByText("2 of 4 projects")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("shows every project and marks the ones they can evaluate", async () => {
    renderPage();
    await findProfile();

    expect(
      (await screen.findByRole("link", { name: "push_swap, can evaluate" })).getAttribute("href"),
    ).toBe("/projects/push_swap");
    expect(screen.getByRole("link", { name: "born2beroot, can evaluate" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "minishell, cannot evaluate" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "cpp09, cannot evaluate" })).toBeTruthy();
    expect(getTutorEligibility).toHaveBeenCalledWith(7);
  });

  it("explains each role", async () => {
    renderPage();
    await findProfile();

    expect(texts(screen.getByRole("region", { name: "Roles" }), "heading").slice(1)).toEqual([
      "Head Tutor",
      "Student Council",
    ]);
  });

  // #304: only the public fields are shown, even if more came back.
  it("never shows private information", async () => {
    vi.mocked(getPublicUser).mockResolvedValue({
      ...lenka,
      email: "lenka@example.com",
      intra_login: "lhusarov",
    } as PublicUser);
    renderPage();
    await findProfile();

    expect(screen.queryByText(/lenka@example\.com/)).toBeNull();
    expect(screen.queryByText(/lhusarov/)).toBeNull();
  });

  it("shows the avatar picture when there is one", async () => {
    vi.mocked(getPublicUser).mockResolvedValue({ ...lenka, avatar_url: "/api/v1/files/3/" });
    const { container } = renderPage();
    await findProfile();

    expect(container.querySelector("img.person-profile__avatar")?.getAttribute("src")).toBe(
      "/api/v1/files/3/",
    );
    expect(screen.queryByText("LH")).toBeNull();
  });

  it("shows only the roles for a Student Council member who is not a Hitchhiker", async () => {
    vi.mocked(getPublicUser).mockResolvedValue({
      ...lenka,
      roles: [
        { id: 1, name: "student" },
        { id: 4, name: "sc_member" },
      ],
    });
    renderPage();
    await findProfile();

    expect(getTutorEligibility).not.toHaveBeenCalled();
    expect(listEvaluationRequests).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Projects" })).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("link", { name: /Create a request/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Find more Hitchhikers" })).toBeTruthy();
  });

  it("says when a Hitchhiker has no projects yet", async () => {
    vi.mocked(getTutorEligibility).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No projects yet.")).toBeTruthy();
  });

  it("keeps the profile when the projects cannot be loaded", async () => {
    vi.mocked(getTutorEligibility).mockRejectedValue(new ApiError(500, "Server error"));
    renderPage();

    expect(await screen.findByText("Could not load the projects.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Lenka Husarova", level: 1 })).toBeTruthy();
  });

  it("shows only their projects, without the bar, when the project list fails", async () => {
    vi.mocked(listProjects).mockRejectedValue(new ApiError(500, "Server error"));
    renderPage();

    expect(await screen.findByRole("link", { name: "push_swap, can evaluate" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /cannot evaluate/ })).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("lists the student's own evaluations with this Hitchhiker", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T08:00:00Z"));
    vi.mocked(listEvaluationRequests).mockImplementation(async (params) =>
      params?.history
        ? page([
            { ...withLenka(makeRequest(31, "push_swap", "confirmed")), result: "passed" },
            withLenka(makeRequest(32, "minishell", "cancelled")),
            withLenka(makeRequest(33, "cpp09", "confirmed"), 9),
          ])
        : page([
            withLenka(makeRequest(34, "born2beroot", "awaiting_confirmation")),
            withLenka(makeRequest(35, "cpp09", "confirmed")),
          ]),
    );
    renderPage();

    const panel = await screen.findByRole("region", {
      name: "Your evaluations with Lenka Husarova",
    });

    await waitFor(() =>
      expect(
        within(panel)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual([
        "/history",
        "/evaluations/34",
        "/evaluations/35",
        "/evaluations/31",
        "/evaluations/32",
      ]),
    );
    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((row) => row.querySelector(".person-profile__outcome")?.textContent),
    ).toEqual(["Needs your answer", "Upcoming", "Passed", "Cancelled"]);
    expect(vi.mocked(listEvaluationRequests).mock.calls).toEqual([
      [{ scope: "mine" }],
      [{ scope: "mine", history: true }],
    ]);
    vi.useRealTimers();
  });

  it("says when the student has no evaluations with this Hitchhiker yet", async () => {
    renderPage();

    expect(await screen.findByText("No evaluations with Lenka Husarova yet.")).toBeTruthy();
  });

  it("keeps the profile when the student's evaluations cannot be loaded", async () => {
    vi.mocked(listEvaluationRequests).mockRejectedValue(new ApiError(500, "Server error"));
    renderPage();

    expect(await screen.findByText("Could not load your evaluations.")).toBeTruthy();
  });

  it("offers a new request to students", async () => {
    renderPage();
    await findProfile();

    expect(screen.getByRole("link", { name: /Create a request/ }).getAttribute("href")).toBe(
      "/requests",
    );
  });

  it("offers no request and no evaluations outside the student workspace", async () => {
    workspace.activeRole = "COUNCIL";
    renderPage();
    await findProfile();

    expect(screen.queryByRole("link", { name: /Create a request/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /Your evaluations/ })).toBeNull();
    expect(listEvaluationRequests).not.toHaveBeenCalled();
  });

  it("links to the profile settings on the own profile", async () => {
    me.id = 7;
    renderPage();
    await findProfile();

    expect(screen.getByRole("link", { name: "Edit your profile" }).getAttribute("href")).toBe(
      "/profile",
    );
    expect(screen.getByText("This is how other students see your profile.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Create a request/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /Your evaluations/ })).toBeNull();
  });

  it("copies the profile link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    await findProfile();

    fireEvent.click(screen.getByRole("button", { name: "Copy profile link" }));

    expect(await screen.findByRole("button", { name: "Link copied ✓" })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  it("says when the profile does not exist", async () => {
    vi.mocked(getPublicUser).mockRejectedValue(new ApiError(404, "Not found.", "not_found"));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Profile not found" })).toBeTruthy();
    expect(getTutorEligibility).not.toHaveBeenCalled();
  });

  it("does not call the API for an id that is not a number", async () => {
    renderPage(["/people/abc"]);

    expect(await screen.findByRole("heading", { name: "Profile not found" })).toBeTruthy();
    expect(getPublicUser).not.toHaveBeenCalled();
  });

  it("shows an error and loads again on Try again", async () => {
    vi.mocked(getPublicUser).mockRejectedValueOnce(new ApiError(500, "Server error"));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load this profile. Please try again.Try again",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await findProfile()).toBeTruthy();
  });

  it("goes to the login page without calling the API when logged out", async () => {
    session.isAuthenticated = false;
    renderPage();

    expect(await screen.findByText("Login page")).toBeTruthy();
    expect(getPublicUser).not.toHaveBeenCalled();
  });

  it("goes back to the page it was opened from", async () => {
    renderPage(["/hitchhikers", "/people/7"]);
    await findProfile();

    fireEvent.click(screen.getByRole("button", { name: /Back/ }));

    expect(await screen.findByText("Hitchhikers page")).toBeTruthy();
  });

  it("links to the Hitchhikers when opened directly", async () => {
    renderPage();
    await findProfile();

    expect(screen.getByRole("link", { name: "Hitchhikers" }).getAttribute("href")).toBe(
      "/hitchhikers",
    );
  });
});
