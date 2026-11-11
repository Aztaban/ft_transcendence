import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import type { ListEvaluationRequestsParams, PickSlotPayload } from "../api/evaluationRequests";
import App from "../App";
import { AuthProvider } from "../store/AuthContext";
import { CurrentUserProvider } from "../store/CurrentUserContext";
import { NotificationCountProvider } from "../store/NotificationCountContext";
import { RoleProvider } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import type { SCMessage } from "../types/scMessage";
import type { RoleName, UserProfile } from "../types/user";

// User flows (#357): the whole application (routing, sidebar, workspaces and pages) walked through
// the main workflows the way a user does, from one page to the next. The API is a small backend
// kept in memory for the test, which follows the contract's rules for what each user sees
// (api-plan §10.4, §10.6, R15, R18), so what one user does is what the next user finds. Each user
// gets a fresh render, as after logging in on another device. The WebSocket is left out; the
// pages load their data when they open.

const pushSwap = { id: 4, slug: "push_swap", name: "push_swap" };
const minishell = { id: 7, slug: "minishell", name: "minishell" };

function profile(id: number, displayName: string, roles: RoleName[]): UserProfile {
  return {
    id,
    email: `${displayName}@example.com`,
    display_name: displayName,
    avatar_url: null,
    language: "en",
    roles: roles.map((name, index) => ({ id: index + 1, name })),
    intra_login: null,
  };
}

const alice = profile(1, "alice", ["student"]);
const bob = profile(2, "bob", ["student", "tutor"]);
const cecile = profile(3, "cecile", ["student", "sc_member"]);
const users = [alice, bob, cecile];

// The projects each Hitchhiker may evaluate (§10.3).
const eligibility: Record<number, (typeof pushSwap)[]> = { [bob.id]: [pushSwap] };

const backend = vi.hoisted(() => ({
  userId: 0,
  nextId: 1,
  requests: [] as EvaluationRequest[],
  messages: [] as SCMessage[],
}));

function me() {
  return users.find((user) => user.id === backend.userId) as UserProfile;
}

function ref(user: UserProfile) {
  return { id: user.id, display_name: user.display_name, avatar_url: user.avatar_url };
}

function page<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

function notFound(): never {
  throw new ApiError(404, "Not found.", "not_found");
}

// §7.1: cancelled and expired requests are history, and so is a confirmed one that has ended.
function isHistory(request: EvaluationRequest) {
  return (
    request.status === "cancelled" ||
    request.status === "expired" ||
    (request.status === "confirmed" && Date.parse(request.ends_at ?? "") < Date.now())
  );
}

// What the current user may see of a request (§8.7): a pending request is anonymous to
// Hitchhikers (R15), and the Hitchhiker is anonymous to the student until they confirm (R18).
function seen(request: EvaluationRequest): EvaluationRequest {
  const isStudent = request.student?.id === backend.userId;
  const hidePicker =
    isStudent && (request.status === "awaiting_confirmation" || request.status === "cancelled");

  return {
    ...request,
    student: !isStudent && request.status === "pending" ? null : request.student,
    picked_by: hidePicker ? null : request.picked_by,
    is_history: isHistory(request),
  };
}

function visible(request: EvaluationRequest) {
  return request.student?.id === backend.userId || request.picked_by?.id === backend.userId;
}

function stored(id: number) {
  const request = backend.requests.find((item) => item.id === id);

  return request && visible(request) ? request : notFound();
}

function listRequests(params: ListEvaluationRequestsParams = {}) {
  const eligible = (eligibility[backend.userId] ?? []).map((project) => project.id);
  const inScope = {
    mine: (request: EvaluationRequest) => request.student?.id === backend.userId,
    open: (request: EvaluationRequest) =>
      request.status === "pending" &&
      eligible.includes(request.project.id) &&
      request.student?.id !== backend.userId,
    picked: (request: EvaluationRequest) => request.picked_by?.id === backend.userId,
    all: () => true,
  }[params.scope ?? "mine"];

  const results = backend.requests
    .filter(inScope)
    .filter((request) => !params.status || params.status.includes(request.status))
    .filter((request) => params.history === undefined || isHistory(request) === params.history)
    .filter((request) => !params.project || request.project.slug === params.project)
    .map(seen)
    .reverse();

  return page(results);
}

function councilOnly() {
  if (!me().roles.some((role) => role.name === "sc_member" || role.name === "admin")) {
    throw new ApiError(403, "Permission denied.", "permission_denied");
  }
}

vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  getSession: vi.fn(async () => {
    const user = me();

    return {
      authenticated: true,
      user: { id: user.id, email: user.email, display_name: user.display_name },
    };
  }),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));
vi.mock("../api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/users")>()),
  getCurrentUser: vi.fn(async () => me()),
  updateCurrentUser: vi.fn(),
  getPublicUser: vi.fn(async () => notFound()),
}));
vi.mock("../api/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/projects")>()),
  listProjects: vi.fn(async () => [minishell, pushSwap]),
  getProject: vi.fn(async () => ({ ...pushSwap, eligible_tutors: [] })),
}));
vi.mock("../api/eligibility", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/eligibility")>()),
  getTutorEligibility: vi.fn(async (userId: number) => eligibility[userId] ?? []),
  listEligibilityRequests: vi.fn(async () => page([])),
  createEligibilityRequest: vi.fn(),
  reviewEligibilityRequest: vi.fn(),
}));
vi.mock("../api/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/notifications")>()),
  getUnreadCount: vi.fn(async () => ({ count: 0 })),
  listNotifications: vi.fn(async () => page([])),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock("../api/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/people")>()),
  searchPeople: vi.fn(async () => page([])),
  countPeople: vi.fn(async () => 1),
}));
vi.mock("../api/evaluationRequests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/evaluationRequests")>()),
  listEvaluationRequests: vi.fn(async (params?: ListEvaluationRequestsParams) =>
    listRequests(params),
  ),
  getEvaluationRequest: vi.fn(async (id: number) => seen(stored(id))),
  createEvaluationRequest: vi.fn(
    async ({ project_id, note }: { project_id: number; note?: string }) => {
      const now = new Date().toISOString();

      backend.requests.push({
        id: backend.nextId++,
        student: ref(me()),
        // An unknown project is a bug in the flow: fail instead of quietly using push_swap.
        project: [pushSwap, minishell].find((project) => project.id === project_id) ?? notFound(),
        note: note ?? "",
        status: "pending",
        picked_by: null,
        starts_at: null,
        ends_at: null,
        cancelled_by: null,
        cancelled_at: null,
        expired_at: null,
        result: null,
        feedback: "",
        completed_at: null,
        is_history: false,
        created_at: now,
        updated_at: now,
      });
    },
  ),
  pickSlot: vi.fn(async (id: number, slot: PickSlotPayload) => {
    const request = backend.requests.find((item) => item.id === id);

    if (!request || !listRequests({ scope: "open" }).results.some((item) => item.id === id)) {
      return notFound();
    }

    Object.assign(request, { ...slot, status: "awaiting_confirmation", picked_by: ref(me()) });

    return seen(request);
  }),
  confirmEvaluationRequest: vi.fn(async (id: number) => {
    const request = stored(id);

    request.status = "confirmed";

    return seen(request);
  }),
  declineEvaluationRequest: vi.fn(),
  cancelEvaluationRequest: vi.fn(),
  releaseEvaluationRequest: vi.fn(),
}));
vi.mock("../api/scMessages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/scMessages")>()),
  // Anonymous (§10.6): the stored message keeps no sender.
  sendSCMessage: vi.fn(async ({ body }: { body: string }) => {
    const message: SCMessage = {
      id: backend.nextId++,
      body,
      read_at: null,
      discussion_note: "",
      discussion_note_version: 0,
      created_at: new Date().toISOString(),
    };

    backend.messages.push(message);

    return { id: message.id, created_at: message.created_at };
  }),
  listSCMessages: vi.fn(async ({ unread }: { unread?: boolean } = {}) => {
    councilOnly();

    return page(
      backend.messages.filter((message) => !unread || message.read_at === null).reverse(),
    );
  }),
  getSCMessage: vi.fn(async (id: number) => {
    councilOnly();

    return backend.messages.find((message) => message.id === id) ?? notFound();
  }),
  setSCMessageRead: vi.fn(async (id: number, isRead: boolean) => {
    councilOnly();
    const message = backend.messages.find((item) => item.id === id) ?? notFound();

    message.read_at = isRead ? new Date().toISOString() : null;

    return message;
  }),
  saveSCMessageNote: vi.fn(),
  deleteSCMessage: vi.fn(),
}));

// Opens the application at `path` as `user`, in a new browser tab (Student workspace).
async function openAs(user: UserProfile, path = "/") {
  cleanup();
  sessionStorage.clear();
  backend.userId = user.id;

  render(
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

  // The top bar shows the name once /users/me/ has answered, so every workspace is known.
  await waitFor(() =>
    expect(document.querySelector(".topbar__username")?.textContent).toBe(user.display_name),
  );
}

function sidebar() {
  return within(screen.getByRole("navigation", { name: "Primary navigation" }));
}

function goTo(menuItem: string) {
  fireEvent.click(sidebar().getByRole("link", { name: menuItem }));
}

// The role selector in the sidebar, as a user switches the workspace.
function switchWorkspace(workspace: string) {
  fireEvent.click(screen.getByRole("button", { name: /STUDENT/ }));
  fireEvent.click(screen.getByRole("option", { name: workspace }));
}

// A flow renders the whole application several times, once per user. Alone it takes about 1 s,
// but in the full parallel run it can pass Vitest's default of 5 s per test, so it gets more.
const FLOW_TIMEOUT = 20_000;

function button(name: string | RegExp) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

beforeEach(() => {
  // Only the clock is fake, so the slot picker offers the same days in every run.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 12, 8, 0));
  backend.userId = 0;
  backend.nextId = 1;
  backend.requests = [];
  backend.messages = [];
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("user flows", { timeout: FLOW_TIMEOUT }, () => {
  it("a student requests an evaluation, a Hitchhiker picks a slot, the student confirms it", async () => {
    // 1. Alice asks for an evaluation of push_swap from the Request page.
    await openAs(alice);
    goTo("Request");
    fireEvent.click(await screen.findByRole("radio", { name: "push_swap" }));
    fireEvent.click(button("Next"));
    fireEvent.click(button("Submit"));

    fireEvent.click(
      await screen.findByRole("dialog", {
        name: "Your request is live and waiting for a HITCHHIKER!",
      }),
    );
    fireEvent.click(screen.getByTestId("request-dialog-backdrop"));

    // Back on Home, the request waits in her open requests.
    const aliceOpen = within(await screen.findByRole("region", { name: "Open Requests" }));
    expect(await aliceOpen.findByRole("heading", { name: "push_swap" })).toBeTruthy();
    expect(aliceOpen.getByText("Pending")).toBeTruthy();

    // 2. Bob, a Hitchhiker for push_swap, finds it in the queue of his workspace and picks a slot.
    await openAs(bob);
    switchWorkspace("HITCHHIKER");
    goTo("Requests");
    fireEvent.click(await screen.findByRole("link", { name: "Review the push_swap request" }));

    await screen.findByRole("heading", { name: "Choose a slot for push_swap" });
    fireEvent.click(button("Tomorrow"));
    fireEvent.click(button("10:00"));
    fireEvent.click(button("10:15"));
    fireEvent.click(button("Submit"));

    await screen.findByRole("dialog");
    fireEvent.click(screen.getByTestId("success-dialog-backdrop"));

    // Back on the queue, which no longer offers it.
    expect(await screen.findByRole("heading", { level: 1, name: "Requests" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Review the push_swap request" })).toBeNull(),
    );

    // 3. Alice sees the proposed slot on Home, without the Hitchhiker's name (R18), and accepts.
    await openAs(alice);
    fireEvent.click(await screen.findByRole("link", { name: "Review the push_swap proposal" }));

    expect(await screen.findByRole("heading", { name: "push_swap" })).toBeTruthy();
    expect(screen.queryByText("bob")).toBeNull();
    fireEvent.click(button(/Accept/));

    expect(
      await screen.findByRole("heading", { name: "Your evaluation is scheduled" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId("evaluation-dialog-backdrop"));

    // 4. The evaluation is on her Pending page, with the slot Bob chose.
    await screen.findByRole("heading", { level: 1, name: "Welcome Back" });
    goTo("Pending");

    const evaluation = (
      await screen.findByRole("heading", { level: 3, name: "push_swap" })
    ).closest("li") as HTMLElement;

    expect(evaluation.querySelector("time")?.getAttribute("dateTime")).toBe(
      new Date(2026, 9, 13, 10, 15).toISOString(),
    );

    // 5. Bob has it on his Pending page too, now with Alice's name (R15).
    await openAs(bob);
    switchWorkspace("HITCHHIKER");
    goTo("Pending");

    expect(await screen.findByRole("heading", { level: 3, name: "push_swap" })).toBeTruthy();
    expect(screen.getByText("alice")).toBeTruthy();
  });

  it("a student sends an anonymous message, a council member reads it and marks it read", async () => {
    // 1. Alice writes to the Student Council from its page.
    await openAs(alice);
    goTo("Student Council");
    fireEvent.click(await screen.findByRole("link", { name: /Send a message/ }));

    fireEvent.change(
      await screen.findByRole("textbox", { name: "Your message to the Student Council" }),
      { target: { value: "The fridge on the second floor is broken again." } },
    );
    fireEvent.click(button("Send Message"));

    await screen.findByRole("dialog", { name: "Message Sent" });
    fireEvent.click(screen.getByTestId("message-sent-backdrop"));
    expect(await screen.findByRole("heading", { level: 1, name: "Student Council" })).toBeTruthy();

    // 2. Cecile, a council member, finds it in the inbox of her Council workspace.
    await openAs(cecile);
    switchWorkspace("COUNCIL");
    goTo("Messages");
    fireEvent.click(await screen.findByRole("link", { name: "Read message #1" }));

    expect(await screen.findByText("The fridge on the second floor is broken again.")).toBeTruthy();
    // The council never sees who sent it.
    expect(screen.queryByText("alice")).toBeNull();
    fireEvent.click(button("Mark as read"));

    await screen.findByRole("dialog", { name: "Done. The message is marked as read." });
    fireEvent.click(screen.getByTestId("marked-read-backdrop"));

    // 3. Back on the inbox, which has nothing new left; the message moved to the History.
    expect(await screen.findByRole("heading", { level: 1, name: /^Messages/ })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 2, name: "All caught up!" })).toBeTruthy();
  });
});
