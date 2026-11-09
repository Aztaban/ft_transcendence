import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "../api/auth";
import App from "../App";
import { AuthProvider } from "../store/AuthContext";
import { CurrentUserProvider } from "../store/CurrentUserContext";
import { NotificationCountProvider } from "../store/NotificationCountContext";
import { RoleProvider } from "../store/RoleContext";
import type { ListEvaluationRequestsParams } from "../api/evaluationRequests";
import type { EvaluationRequest } from "../types/evaluation";
import { accessibilityViolations } from "./axe";

// Accessibility scan of the whole application (#359): every main route is rendered with the
// sidebar, top bar and footer, with data from mocked APIs, and checked with axe-core against the
// WCAG 2.1 A and AA rules. The WebSocket is left out; the pages work without it.

const user = {
  id: 1,
  email: "diana@example.com",
  display_name: "dkolarov",
  avatar_url: null,
  language: "en" as const,
  // Every role, so every workspace and page can be opened.
  roles: [
    { id: 1, name: "student" as const },
    { id: 2, name: "tutor" as const },
    { id: 3, name: "head_tutor" as const },
    { id: 4, name: "sc_member" as const },
    { id: 5, name: "admin" as const },
  ],
  intra_login: null,
};

const project = { id: 4, slug: "push_swap", name: "push_swap" };

function evaluation(id: number, extra: Partial<EvaluationRequest> = {}): EvaluationRequest {
  return {
    id,
    student: { id: 1, display_name: "dkolarov", avatar_url: null },
    project,
    note: "",
    status: "confirmed",
    picked_by: { id: 2, display_name: "Lenka", avatar_url: null },
    starts_at: "2030-01-10T09:00:00Z",
    ends_at: "2030-01-10T09:45:00Z",
    cancelled_by: null,
    cancelled_at: null,
    expired_at: null,
    result: null,
    feedback: "",
    completed_at: null,
    is_history: false,
    created_at: "2026-10-28T09:00:00Z",
    updated_at: "2026-10-28T09:00:00Z",
    ...extra,
  };
}

function page<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

const person = {
  id: 2,
  display_name: "Lenka",
  avatar_url: null,
  roles: [
    { id: 1, name: "student" as const },
    { id: 2, name: "tutor" as const },
  ],
  eligible_projects: [project],
};

const eligibilityRequest = {
  id: 9,
  requester: { id: 2, display_name: "Lenka", avatar_url: null },
  projects: [project],
  status: "pending" as const,
  reviewed_by: null,
  reviewed_at: null,
  review_note: "",
  created_at: "2026-10-29T09:00:00Z",
};

const message = {
  id: 3,
  body: "The fridge on the second floor is broken again.",
  read_at: null,
  discussion_note: "",
  discussion_note_version: 0,
  created_at: "2026-10-30T09:00:00Z",
};

// Each API module keeps its real exports (constants, types) and only the calls the pages make are
// replaced, so a new export in a module never breaks this file.
vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  getSession: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));
vi.mock("../api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/users")>()),
  getCurrentUser: vi.fn(async () => user),
  updateCurrentUser: vi.fn(),
  getPublicUser: vi.fn(async () => person),
  assignRole: vi.fn(),
  revokeRole: vi.fn(),
}));
vi.mock("../api/evaluationRequests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/evaluationRequests")>()),
  // Each list answers for its own filter, so no page shows the same request twice.
  listEvaluationRequests: vi.fn(async (params?: ListEvaluationRequestsParams) => {
    if (params?.history) {
      return page([
        evaluation(7, {
          result: "passed",
          is_history: true,
          completed_at: "2026-10-20T10:00:00Z",
          starts_at: "2026-10-20T09:00:00Z",
          ends_at: "2026-10-20T09:45:00Z",
        }),
      ]);
    }

    if (params?.scope === "open" || params?.status?.includes("pending")) {
      return page([
        evaluation(6, { status: "pending", picked_by: null, starts_at: null, ends_at: null }),
      ]);
    }

    return page([evaluation(5)]);
  }),
  getEvaluationRequest: vi.fn(async (id: number) =>
    id === 6
      ? evaluation(6, { status: "pending", picked_by: null, starts_at: null, ends_at: null })
      : evaluation(id),
  ),
  pickSlot: vi.fn(),
  confirmEvaluationRequest: vi.fn(),
  declineEvaluationRequest: vi.fn(),
  createEvaluationRequest: vi.fn(),
  cancelEvaluationRequest: vi.fn(),
  releaseEvaluationRequest: vi.fn(),
}));
vi.mock("../api/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/projects")>()),
  listProjects: vi.fn(async () => [project, { id: 7, slug: "minishell", name: "minishell" }]),
  getProject: vi.fn(async () => ({ ...project, eligible_tutors: [] })),
}));
vi.mock("../api/eligibility", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/eligibility")>()),
  createEligibilityRequest: vi.fn(),
  getTutorEligibility: vi.fn(async () => [project]),
  listEligibilityRequests: vi.fn(async () => page([eligibilityRequest])),
  reviewEligibilityRequest: vi.fn(),
}));
vi.mock("../api/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/notifications")>()),
  getUnreadCount: vi.fn(async () => ({ count: 2 })),
  listNotifications: vi.fn(async () => page([])),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock("../api/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/people")>()),
  searchPeople: vi.fn(async () => page([person])),
  countPeople: vi.fn(async () => 1),
}));
vi.mock("../api/scMessages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/scMessages")>()),
  sendSCMessage: vi.fn(),
  listSCMessages: vi.fn(async () => page([message])),
  getSCMessage: vi.fn(async () => message),
  setSCMessageRead: vi.fn(),
  saveSCMessageNote: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({
    authenticated: true,
    user: { id: user.id, email: user.email, display_name: user.display_name },
  });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CurrentUserProvider>
          <NotificationCountProvider>
            <RoleProvider>
              <App />
            </RoleProvider>
          </NotificationCountProvider>
        </CurrentUserProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

// The page itself is shown with its data: its own main heading (not an error, 404 or Unauthorized
// page, which would pass a scan too), no loading placeholder left and no error shown.
async function loaded(heading: string | RegExp) {
  await screen.findByRole("heading", { level: 1, name: heading }, { timeout: 3000 });
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull(), {
    timeout: 3000,
  });
  // A failed load keeps the page's heading but shows an error: that is not the page to scan.
  expect(screen.queryByRole("alert")).toBeNull();
}

describe("accessibility of every page (axe-core, WCAG 2.1 AA)", () => {
  it.each([
    ["/", "STUDENT", "Welcome Back"],
    ["/", "HITCHHIKER", "Welcome Back"],
    ["/", "COUNCIL", "Welcome Back"],
    ["/requests", "STUDENT", "Create New Request"],
    ["/requests", "HITCHHIKER", "Requests"],
    ["/pending", "STUDENT", "Pending Evaluations"],
    ["/history", "STUDENT", "History"],
    ["/evaluations/5", "STUDENT", "Your evaluation is scheduled"],
    ["/profile", "STUDENT", "dkolarov"],
    ["/hitchhikers", "STUDENT", "Hitchhikers"],
    ["/people/2", "STUDENT", "Lenka"],
    ["/projects/push_swap", "STUDENT", "push_swap"],
    ["/council", "STUDENT", "Student Council"],
    ["/council/send", "STUDENT", "Anonymous Message"],
    ["/council/inbox", "COUNCIL", /^Messages/],
    ["/council/inbox/3", "COUNCIL", "Message #3"],
    ["/council/history", "COUNCIL", /^Message history/],
    ["/eligibility-requests/new", "HITCHHIKER", "Projects you can evaluate"],
    ["/eligibility-requests", "HITCHHIKER", "Eligibility requests"],
    ["/privacy", "STUDENT", "Privacy Policy"],
    ["/terms", "STUDENT", "Terms of Service"],
    ["/requests/6", "HITCHHIKER", "Choose a slot for push_swap"],
    ["/does-not-exist", "STUDENT", "404"],
  ])("%s in the %s workspace", async (path, workspace, heading) => {
    sessionStorage.setItem("active-role", workspace);
    renderAt(path);
    // Until /users/me/ answers every workspace is offered: wait for it (the top bar shows the
    // name), so a page the roles do not allow shows Unauthorized before the check.
    await waitFor(
      () => expect(document.querySelector(".topbar__username")?.textContent).toBe("dkolarov"),
      { timeout: 3000 },
    );
    await loaded(heading);

    expect(await accessibilityViolations()).toEqual([]);
  });

  it.each([
    ["/login", "Log in"],
    ["/register", "Create an account"],
  ])("%s when logged out", async (path, heading) => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
    renderAt(path);
    await loaded(heading);

    expect(await accessibilityViolations()).toEqual([]);
  });
});
