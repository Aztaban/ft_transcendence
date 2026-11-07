import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "../api/auth";
import App from "../App";
import { AuthProvider } from "../store/AuthContext";
import { CurrentUserProvider } from "../store/CurrentUserContext";
import { NotificationCountProvider } from "../store/NotificationCountContext";
import { RoleProvider } from "../store/RoleContext";
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

const message = {
  id: 3,
  body: "The fridge on the second floor is broken again.",
  read_at: null,
  discussion_note: "",
  discussion_note_version: 0,
  created_at: "2026-10-30T09:00:00Z",
};

vi.mock("../api/auth", () => ({
  getSession: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));
vi.mock("../api/users", () => ({
  getCurrentUser: vi.fn(async () => user),
  updateCurrentUser: vi.fn(),
  getPublicUser: vi.fn(async () => person),
  assignRole: vi.fn(),
  revokeRole: vi.fn(),
}));
vi.mock("../api/evaluationRequests", () => ({
  listEvaluationRequests: vi.fn(async () =>
    page([evaluation(5), evaluation(6, { status: "pending", picked_by: null, starts_at: null })]),
  ),
  getEvaluationRequest: vi.fn(async () => evaluation(5)),
  pickSlot: vi.fn(),
  confirmEvaluationRequest: vi.fn(),
  declineEvaluationRequest: vi.fn(),
  createEvaluationRequest: vi.fn(),
  cancelEvaluationRequest: vi.fn(),
  releaseEvaluationRequest: vi.fn(),
}));
vi.mock("../api/projects", () => ({
  listProjects: vi.fn(async () => [project, { id: 7, slug: "minishell", name: "minishell" }]),
  getProject: vi.fn(async () => ({ ...project, eligible_tutors: [] })),
}));
vi.mock("../api/eligibility", () => ({
  createEligibilityRequest: vi.fn(),
  getTutorEligibility: vi.fn(async () => [project]),
  listEligibilityRequests: vi.fn(async () =>
    page([
      {
        id: 9,
        requester: { id: 2, display_name: "Lenka", avatar_url: null },
        projects: [project],
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        review_note: "",
        created_at: "2026-10-29T09:00:00Z",
      },
    ]),
  ),
  reviewEligibilityRequest: vi.fn(),
}));
vi.mock("../api/notifications", () => ({
  getUnreadCount: vi.fn(async () => ({ count: 2 })),
  listNotifications: vi.fn(async () => page([])),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock("../api/people", () => ({
  searchPeople: vi.fn(async () => page([person])),
  countPeople: vi.fn(async () => 1),
}));
vi.mock("../api/scMessages", () => ({
  SC_MESSAGE_MAX_LENGTH: 5000,
  SC_NOTE_MAX_LENGTH: 5000,
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

// The page is shown with its data: a main heading, and no loading placeholder left.
async function loaded() {
  await screen.findByRole("heading", { level: 1 }, { timeout: 3000 });
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull(), {
    timeout: 3000,
  });
}

describe("accessibility of every page (axe-core, WCAG 2.1 AA)", () => {
  it.each([
    ["/", "STUDENT"],
    ["/", "HITCHHIKER"],
    ["/", "COUNCIL"],
    ["/requests", "STUDENT"],
    ["/requests", "HITCHHIKER"],
    ["/pending", "STUDENT"],
    ["/history", "STUDENT"],
    ["/evaluations/5", "STUDENT"],
    ["/profile", "STUDENT"],
    ["/hitchhikers", "STUDENT"],
    ["/people/2", "STUDENT"],
    ["/projects/push_swap", "STUDENT"],
    ["/council", "STUDENT"],
    ["/council/send", "STUDENT"],
    ["/council/inbox", "COUNCIL"],
    ["/council/inbox/3", "COUNCIL"],
    ["/council/history", "COUNCIL"],
    ["/eligibility-requests/new", "HITCHHIKER"],
    ["/eligibility-requests", "HITCHHIKER"],
    ["/privacy", "STUDENT"],
    ["/does-not-exist", "STUDENT"],
  ])("%s in the %s workspace", async (path, workspace) => {
    sessionStorage.setItem("active-role", workspace);
    renderAt(path);
    await loaded();

    expect(await accessibilityViolations()).toEqual([]);
  });

  it.each(["/login", "/register"])("%s when logged out", async (path) => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
    renderAt(path);
    await loaded();

    expect(await accessibilityViolations()).toEqual([]);
  });
});
