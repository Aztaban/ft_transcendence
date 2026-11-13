import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getTutorEligibility } from "../api/eligibility";
import { listEvaluationRequests } from "../api/evaluationRequests";
import { listProjects } from "../api/projects";
import { assignRole, getPublicUser, revokeRole } from "../api/users";
import i18n from "../i18n";
import { makeRequest } from "../features/student/testUtils";
import type { EvaluationRequest } from "../types/evaluation";
import type { PublicUser } from "../types/people";
import type { UserRole } from "../types/user";
import PersonProfilePage from "./PersonProfilePage";

const session = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));
const workspace = vi.hoisted(() => ({ activeRole: "STUDENT" }));
const me = vi.hoisted(() => ({
  id: 1,
  roles: [{ id: 1, name: "student" }] as UserRole[],
}));

vi.mock("../api/users", () => ({
  getPublicUser: vi.fn(),
  assignRole: vi.fn(),
  revokeRole: vi.fn(),
}));
vi.mock("../api/eligibility", () => ({ getTutorEligibility: vi.fn() }));
vi.mock("../api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("../store/AuthContext", () => ({ useAuth: () => session }));
vi.mock("../store/RoleContext", () => ({ useRole: () => workspace }));
vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    user: { id: me.id, roles: me.roles },
    roles: [],
    isLoaded: true,
    refresh: () => {},
  }),
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
  me.roles = [{ id: 1, name: "student" }];
  cleanup();
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
});

const routes = (
  <Routes>
    <Route path="/people/:id" element={<PersonProfilePage />} />
    <Route path="/hitchhikers" element={<div>Hitchhikers page</div>} />
    <Route path="/login" element={<div>Login page</div>} />
  </Routes>
);

function renderPage(entries = ["/people/7"]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      {routes}
    </MemoryRouter>,
  );
}

// The Back button reads the tab's history, which React Router records in `history.state.idx`
// (0 for the first page of the app): open the Hitchhikers, then the profile.
function renderFromHitchhikers() {
  window.history.replaceState({ usr: null, key: "list", idx: 0 }, "", "/hitchhikers");
  window.history.pushState({ usr: null, key: "profile", idx: 1 }, "", "/people/7");

  return render(<BrowserRouter>{routes}</BrowserRouter>);
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
    // The tab name is set right after the page draws the loaded profile.
    await waitFor(() => expect(document.title).toBe("Lenka Husarova · 42 Evals"));
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
    vi.mocked(getPublicUser).mockResolvedValue({ ...lenka, avatar_url: "/avatar.png" });
    const { container } = renderPage();
    await findProfile();

    expect(container.querySelector("img.person-profile__avatar")?.getAttribute("src")).toBe(
      "/avatar.png",
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
      [{ scope: "mine", history: false }],
      [{ scope: "mine", history: true }],
    ]);
    vi.useRealTimers();
  });

  // #771: a request that is in both answers (it moved to the history between them) is one row,
  // and React logs no duplicate-key warning.
  it("shows an evaluation that comes back in both lists only once", async () => {
    const consoleError = vi.spyOn(console, "error");
    const finished = {
      ...withLenka(makeRequest(31, "push_swap", "confirmed")),
      result: "passed" as const,
    };

    vi.mocked(listEvaluationRequests).mockResolvedValue(page([finished]));
    renderPage();

    const panel = await screen.findByRole("region", {
      name: "Your evaluations with Lenka Husarova",
    });

    await waitFor(() => expect(within(panel).getAllByRole("listitem")).toHaveLength(1));
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
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

  // #679: Head Tutors, SC Members and Admins change roles from the profile.
  it("lets an Admin remove a role and shows the new role pills", async () => {
    me.roles = [
      { id: 1, name: "student" },
      { id: 5, name: "admin" },
    ];
    vi.mocked(revokeRole).mockResolvedValue(undefined);
    renderPage();
    await findProfile();

    fireEvent.click(screen.getByRole("button", { name: "Remove the role Student Council" }));

    expect(await screen.findByText("Role Student Council removed.")).toBeTruthy();
    expect(revokeRole).toHaveBeenCalledWith(7, 4);
    expect(texts(screen.getByRole("list", { name: "Roles" }), "listitem")).toEqual(["Head Tutor"]);
  });

  // #369: the new roles replace the person, but the projects and the evaluations stay shown.
  it("keeps the projects and the evaluations after a role change, without loading them again", async () => {
    me.roles = [
      { id: 1, name: "student" },
      { id: 5, name: "admin" },
    ];
    vi.mocked(revokeRole).mockResolvedValue(undefined);
    renderPage();
    await findProfile();
    await waitFor(() => expect(listEvaluationRequests).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Remove the role Student Council" }));

    expect(await screen.findByText("Role Student Council removed.")).toBeTruthy();
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
    expect(getTutorEligibility).toHaveBeenCalledTimes(1);
    expect(listProjects).toHaveBeenCalledTimes(1);
    expect(listEvaluationRequests).toHaveBeenCalledTimes(2);
  });

  it("lets a Head Tutor make a student a Hitchhiker", async () => {
    const student: PublicUser = { ...lenka, roles: [{ id: 1, name: "student" }] };

    me.roles = [
      { id: 1, name: "student" },
      { id: 3, name: "head_tutor" },
    ];
    vi.mocked(getPublicUser).mockResolvedValue(student);
    vi.mocked(assignRole).mockResolvedValue({
      ...student,
      roles: [
        { id: 1, name: "student" },
        { id: 2, name: "tutor" },
      ],
    });
    renderPage();
    await findProfile();

    fireEvent.click(screen.getByRole("button", { name: "Add role" }));

    expect(await screen.findByText("Role Hitchhiker added.")).toBeTruthy();
    expect(assignRole).toHaveBeenCalledWith(7, "tutor");
    expect(texts(screen.getByRole("list", { name: "Roles" }), "listitem")).toEqual(["Hitchhiker"]);
  });

  it("does not offer role changes to students or on the own profile", async () => {
    renderPage();
    await findProfile();

    expect(screen.queryByRole("heading", { name: "Manage roles" })).toBeNull();

    cleanup();
    me.id = 7;
    me.roles = [
      { id: 1, name: "student" },
      { id: 5, name: "admin" },
    ];
    renderPage();
    await findProfile();

    expect(screen.queryByRole("heading", { name: "Manage roles" })).toBeNull();
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
    // The tab name is set right after the page draws the loaded profile.
    await waitFor(() => expect(document.title).toBe("Profile not found · 42 Evals"));
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
    renderFromHitchhikers();
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

describe("PersonProfilePage in another language", () => {
  it("shows the profile, its roles and the projects in Spanish", async () => {
    await i18n.changeLanguage("es");
    renderPage();
    await findProfile();

    const roles = screen.getByRole("list", { name: "Roles" });

    expect(texts(roles, "listitem")).toEqual(["Head Tutor", "Consejo estudiantil"]);
    expect(await screen.findByText("2 de 4 proyectos")).toBeTruthy();
    expect(screen.getByRole("link", { name: "push_swap, puede evaluar" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "cpp09, no puede evaluar" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buscar más Hitchhikers" })).toBeTruthy();
  });
});
