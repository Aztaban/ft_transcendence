import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getSession, loginUser } from "./api/auth";
import { getEligibilityRequest } from "./api/eligibility";
import { listEvaluationRequests } from "./api/evaluationRequests";
import { listProjects } from "./api/projects";
import { getCurrentUser } from "./api/users";
import App from "./App";
import { AuthProvider } from "./store/AuthContext";
import { RoleProvider } from "./store/RoleContext";

vi.mock("./api/auth", () => ({
  getSession: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));
vi.mock("./api/eligibility", () => ({
  createEligibilityRequest: vi.fn(),
  getEligibilityRequest: vi.fn(),
  getTutorEligibility: vi.fn(),
  listEligibilityRequests: vi.fn(),
  reviewEligibilityRequest: vi.fn(),
}));
vi.mock("./api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("./api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("./api/users", () => ({
  getCurrentUser: vi.fn(),
  getPublicUser: vi.fn(),
  updateCurrentUser: vi.fn(),
}));

// The user's real roles from /users/me/. By default nothing is loaded, as without a provider; a
// test sets `roles` and `isLoaded` when a page depends on them.
const currentUser = vi.hoisted(() => ({ roles: [] as string[], isLoaded: false }));

vi.mock("./store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
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

    expect(footer.getByText("© transcendence 2026")).toBeDefined();

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

  test("keeps /eligibility-requests/new for the request form, not as a request id", async () => {
    renderAt("/eligibility-requests/new");

    expect(await screen.findByText("ACCESS RESTRICTED")).toBeDefined();
    expect(getEligibilityRequest).not.toHaveBeenCalled();
  });

  test("opens /profile from the Student Council workspace instead of refusing it", async () => {
    sessionStorage.setItem("active-role", "COUNCIL");
    currentUser.roles = ["student", "tutor", "sc_member"];
    currentUser.isLoaded = true;
    vi.mocked(getCurrentUser).mockResolvedValue({
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
    });

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

    expect(await screen.findByRole("heading", { name: "History" })).toBeDefined();
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

    expect(await screen.findByRole("heading", { name: "History" })).toBeDefined();
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

    expect(await screen.findByRole("heading", { name: "History" })).toBeDefined();
    expect(sessionStorage.getItem("login-return-to")).toBeNull();
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

    expect(await screen.findByRole("heading", { name: "History" })).toBeDefined();
    expect(sessionStorage.getItem("login-return-to")).toBeNull();
  });
});
