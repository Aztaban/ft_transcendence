import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getAdminUser, updateAdminUser } from "./api/admin";
import { getSession, loginUser } from "./api/auth";
import { getEligibilityRequest, listEligibilityRequests } from "./api/eligibility";
import { getEvaluationRequest, listEvaluationRequests } from "./api/evaluationRequests";
import { listProjects } from "./api/projects";
import App from "./App";
import { makeRequest } from "./features/student/testUtils";
import type { UserProfile } from "./types/user";
import { AuthProvider } from "./store/AuthContext";
import { RoleProvider } from "./store/RoleContext";

vi.mock("./api/auth", () => ({
  getSession: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));
vi.mock("./api/admin", () => ({
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
}));
vi.mock("./api/eligibility", () => ({
  createEligibilityRequest: vi.fn(),
  getEligibilityRequest: vi.fn(),
  getTutorEligibility: vi.fn(),
  listEligibilityRequests: vi.fn(),
  reviewEligibilityRequest: vi.fn(),
}));
vi.mock("./api/evaluationRequests", () => ({
  getEvaluationRequest: vi.fn(),
  listEvaluationRequests: vi.fn(),
}));
vi.mock("./api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("./api/users", () => ({
  getCurrentUser: vi.fn(),
  getPublicUser: vi.fn(),
  updateCurrentUser: vi.fn(),
}));

// The user's real roles from /users/me/. By default nothing is loaded, as without a provider; a
// test sets `roles` and `isLoaded` when a page depends on them.
const currentUser = vi.hoisted(() => ({
  user: null as UserProfile | null,
  roles: [] as string[],
  isLoaded: false,
}));

vi.mock("./store/CurrentUserContext", () => ({
  useCurrentUser: () => ({
    ...currentUser,
    loadFailed: false,
    update: () => Promise.resolve(),
  }),
}));

const user = { id: 1, email: "student@example.com", display_name: "Student" };

beforeEach(() => {
  vi.mocked(listProjects).mockResolvedValue([]);
  vi.mocked(listEvaluationRequests).mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
  currentUser.user = null;
  currentUser.roles = [];
  currentUser.isLoaded = false;
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <RoleProvider>
          <App />
        </RoleProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

describe("logged in", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: true, user });
  });

  test("renders the home page at /", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeDefined();
  });

  test("renders the 404 page for an unknown path", async () => {
    renderAt("/does-not-exist");
    expect(await screen.findByText("404")).toBeDefined();
    expect(screen.getByText("Page not found.")).toBeDefined();
  });

  test.each([
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Service"],
  ])("keeps the application shell around %s", async (path, title) => {
    const { container } = renderAt(path);

    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeDefined();
    expect(container.querySelector(".sidebar")).toBeTruthy();
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  test("links to both legal pages inside the application", async () => {
    renderAt("/");

    const footer = within(await screen.findByRole("contentinfo"));

    expect(footer.getByText(`© transcendence ${new Date().getFullYear()}`)).toBeDefined();

    expect(footer.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
      "/privacy",
    );
    expect(footer.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe(
      "/terms",
    );
  });

  test("renders the application shell around every route", async () => {
    const { container } = renderAt("/");
    await screen.findByRole("heading", { name: "Welcome Back" });
    expect(container.querySelector(".sidebar")).toBeTruthy();
    expect(container.querySelector(".topbar")).toBeTruthy();
  });

  // #770: a Hitchhiker workspace restored from the tab, for a user who may have lost the role.
  test("asks for no Hitchhiker list before /users/me/ confirms the workspace", async () => {
    sessionStorage.setItem("active-role", "HITCHHIKER");

    const { container } = renderAt("/pending");

    await waitFor(() => expect(container.querySelector(".sidebar")).toBeTruthy());
    await act(async () => {});

    expect(listEvaluationRequests).not.toHaveBeenCalled();
  });

  test("asks for no Hitchhiker list when the stored workspace's role was lost", async () => {
    sessionStorage.setItem("active-role", "HITCHHIKER");
    currentUser.roles = ["student"];
    currentUser.isLoaded = true;

    renderAt("/pending");

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    await act(async () => {});

    expect(
      vi.mocked(listEvaluationRequests).mock.calls.filter(([params]) => params?.scope === "picked"),
    ).toEqual([]);
  });

  // #687: notifications link to /profile from any workspace (§8.8).
  test("opens an eligibility request from a notification in any workspace", async () => {
    sessionStorage.setItem("active-role", "COUNCIL");
    currentUser.roles = ["student", "head_tutor", "sc_member"];
    currentUser.isLoaded = true;
    vi.mocked(getEligibilityRequest).mockResolvedValue({
      id: 9,
      requester: { id: 42, display_name: "Bob", avatar_url: null },
      projects: [{ id: 4, slug: "libft", name: "Libft" }],
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      review_note: "",
      created_at: "2026-10-09T08:00:00Z",
    });

    renderAt("/eligibility-requests/9");

    // The heading is there at once; the requester only once the request has loaded.
    expect(await screen.findByRole("link", { name: "Bob" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Eligibility request" })).toBeDefined();
    expect(getEligibilityRequest).toHaveBeenCalledWith(9);
  });

  // The eligibility request page links to both from any workspace (#685).
  test.each([
    ["/eligibility-requests", "Eligibility requests"],
    ["/eligibility-requests/new", "Projects you can evaluate"],
  ])("opens %s from the Student workspace by switching to Hitchhiker", async (path, title) => {
    currentUser.roles = ["student", "tutor", "head_tutor"];
    currentUser.isLoaded = true;
    vi.mocked(listEligibilityRequests).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    renderAt(path);

    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeDefined();
    expect(screen.queryByText("ACCESS RESTRICTED")).toBeNull();
    // RoleProvider saves the workspace in an effect, which React may run just after the heading
    // is drawn: wait for it rather than reading it once.
    await waitFor(() => expect(sessionStorage.getItem("active-role")).toBe("HITCHHIKER"));
  });

  test("keeps /eligibility-requests/new for the request form, not as a request id", async () => {
    // A student without a Hitchhiker workspace: the form's guard refuses, nothing is loaded.
    currentUser.roles = ["student"];
    currentUser.isLoaded = true;
    renderAt("/eligibility-requests/new");

    expect(await screen.findByText("ACCESS RESTRICTED")).toBeDefined();
    expect(getEligibilityRequest).not.toHaveBeenCalled();
  });

  test("opens /profile from the Student Council workspace instead of refusing it", async () => {
    sessionStorage.setItem("active-role", "COUNCIL");
    currentUser.roles = ["student", "tutor", "sc_member"];
    currentUser.isLoaded = true;
    currentUser.user = {
      ...user,
      display_name: "Bob",
      avatar_url: null,
      language: "en",
      roles: [
        { id: 1, name: "student" },
        { id: 2, name: "sc_member" },
        { id: 3, name: "tutor" },
      ],
      intra_login: null,
    };

    renderAt("/profile");

    expect(await screen.findByRole("heading", { name: "Bob" })).toBeDefined();
    expect(screen.queryByText("This page is not available for your current role.")).toBeNull();
  });
});

// #328: logged out, no page is shown and no API is called except the session check.
describe("logged out", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
  });

  test.each([
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Service"],
  ])("opens %s without a session", async (path, title) => {
    const { container } = renderAt(path);

    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeDefined();
    expect(container.querySelector(".sidebar")).toBeNull();
  });

  // Matched like the logged-in routes, so the same link works with or without a session.
  test.each(["/Privacy", "/terms/"])("opens %s like the logged-in route does", async (path) => {
    renderAt(path);

    expect(await screen.findByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  test("opens the next page at its top, not where the last one was scrolled to", async () => {
    renderAt("/privacy");
    const footer = within(await screen.findByRole("contentinfo"));

    document.documentElement.scrollTop = 900;
    fireEvent.click(footer.getByRole("link", { name: "Terms of Service" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeDefined();
    expect(document.documentElement.scrollTop).toBe(0);
  });

  test.each(["/privacy", "/terms"])("links to both legal pages from %s", async (path) => {
    renderAt(path);

    const footer = within(await screen.findByRole("contentinfo"));

    expect(footer.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
      "/privacy",
    );
    expect(footer.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe(
      "/terms",
    );
  });

  // Leaving in the same tab would lose the form and the page to return to after login.
  test.each(["/login", "/register"])("opens the legal pages in a new tab from %s", async (path) => {
    renderAt(path);

    const footer = within(await screen.findByRole("contentinfo"));

    for (const [name, href] of [
      ["Privacy Policy (opens in a new tab)", "/privacy"],
      ["Terms of Service (opens in a new tab)", "/terms"],
    ]) {
      const link = footer.getByRole("link", { name });

      expect(link.getAttribute("href")).toBe(href);
      expect(link.getAttribute("target")).toBe("_blank");
    }
  });

  test("sends every page to the login page without calling its APIs", async () => {
    const { container } = renderAt("/history");

    expect(await screen.findByLabelText("Email")).toBeDefined();
    expect(container.querySelector(".sidebar")).toBeNull();
    expect(listEvaluationRequests).not.toHaveBeenCalled();
  });

  test("brings the user back to the page they wanted after logging in", async () => {
    vi.mocked(loginUser).mockResolvedValue({ ...user, message: "Logged in." });
    renderAt("/history?status=cancelled");

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-pass" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form") as HTMLFormElement);

    expect(await screen.findByRole("heading", { level: 1, name: "History" })).toBeDefined();
  });

  test("shows nothing while the session check runs", () => {
    vi.mocked(getSession).mockReturnValue(new Promise(() => {}));
    const { container } = renderAt("/history");

    expect(container.querySelector(".sidebar")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });
});

describe("42 login", () => {
  test("remembers the page when the user leaves for 42", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
    renderAt("/history?status=cancelled");

    const link = await screen.findByRole("link", { name: /CONTINUE WITH 42/ });

    // jsdom cannot follow the link to the backend; the remembered page is what matters here.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);

    expect(sessionStorage.getItem("login-return-to")).toBe("/history?status=cancelled");
  });

  test("opens the remembered page when the user comes back logged in", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: true, user });
    sessionStorage.setItem("login-return-to", "/history?status=cancelled");
    renderAt("/");

    expect(await screen.findByRole("heading", { level: 1, name: "History" })).toBeDefined();
    expect(sessionStorage.getItem("login-return-to")).toBeNull();
  });

  test("prefers the page from the gate over one kept for an earlier 42 login", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
    vi.mocked(loginUser).mockResolvedValue({ ...user, message: "Logged in." });
    sessionStorage.setItem("login-return-to", "/pending");
    renderAt("/history");

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-pass" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form") as HTMLFormElement);

    expect(await screen.findByRole("heading", { level: 1, name: "History" })).toBeDefined();
    expect(sessionStorage.getItem("login-return-to")).toBeNull();
    // The kept page was dropped at login, so nothing opens it once the app is shown.
    await act(async () => {});
    expect(screen.getByRole("heading", { level: 1, name: "History" })).toBeDefined();
  });

  test("uses the page kept for 42 when the 42 login failed and the form is used instead", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
    vi.mocked(loginUser).mockResolvedValue({ ...user, message: "Logged in." });
    sessionStorage.setItem("login-return-to", "/history?status=cancelled");
    renderAt("/login?oauth=oauth_access_denied");

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-pass" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form") as HTMLFormElement);

    expect(await screen.findByRole("heading", { level: 1, name: "History" })).toBeDefined();
    expect(sessionStorage.getItem("login-return-to")).toBeNull();
  });
});

describe("Administration user page", () => {
  // Opens another user's page in place, as Back or a link from outside the list would.
  function OpenUser({ id }: { id: number }) {
    const navigate = useNavigate();

    return (
      <button type="button" onClick={() => navigate(`/manage/users/${id}`)}>
        open user {id}
      </button>
    );
  }

  function adminUser(id: number) {
    return {
      id,
      email: `user${id}@example.com`,
      display_name: `User ${id}`,
      avatar_url: null,
      language: "en" as const,
      roles: [{ id: 1, name: "student" as const }],
      intra_login: null,
      status: "active" as const,
      created_at: "2026-10-01T08:00:00Z",
      last_login: null,
    };
  }

  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: true, user });
    currentUser.roles = ["student", "admin"];
    currentUser.isLoaded = true;
    sessionStorage.setItem("active-role", "ADMIN");
  });

  test("starts with a fresh page when another user is opened", async () => {
    vi.mocked(getAdminUser).mockImplementation((id) =>
      // User 2 stays loading, so the test sees what is shown in the meantime.
      id === 1 ? Promise.resolve(adminUser(1)) : new Promise(() => {}),
    );
    vi.mocked(updateAdminUser).mockResolvedValue({ ...adminUser(1), display_name: "Renamed" });

    render(
      <MemoryRouter initialEntries={["/manage/users/1"]}>
        <AuthProvider>
          <RoleProvider>
            <OpenUser id={2} />
            <App />
          </RoleProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Display name"), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Changes saved.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "open user 2" }));

    expect(await screen.findByText("Loading the user…")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Renamed" })).toBeNull();
    expect(screen.queryByText("Changes saved.")).toBeNull();
    expect(getAdminUser).toHaveBeenLastCalledWith(2);
  });
});

describe("Evaluation page", () => {
  // Opens another evaluation in place, as a link in the notification panel would.
  function OpenEvaluation({ id }: { id: number }) {
    const navigate = useNavigate();

    return (
      <button type="button" onClick={() => navigate(`/evaluations/${id}`)}>
        open evaluation {id}
      </button>
    );
  }

  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: true, user });
  });

  // #369: the previous evaluation is never shown while the next one loads.
  test("starts with a fresh page when another evaluation is opened", async () => {
    vi.mocked(getEvaluationRequest).mockImplementation((id) =>
      // Evaluation 2 stays loading, so the test sees what is shown in the meantime.
      id === 1 ? Promise.resolve(makeRequest(1, "push_swap", "confirmed")) : new Promise(() => {}),
    );

    render(
      <MemoryRouter initialEntries={["/evaluations/1"]}>
        <AuthProvider>
          <RoleProvider>
            <OpenEvaluation id={2} />
            <App />
          </RoleProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("article")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "open evaluation 2" }));

    expect(await screen.findByText("Loading the evaluation…")).toBeDefined();
    expect(screen.queryByRole("article")).toBeNull();
    expect(getEvaluationRequest).toHaveBeenLastCalledWith(2);
  });
});
