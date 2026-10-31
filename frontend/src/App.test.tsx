import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getSession, loginUser } from "./api/auth";
import { listEvaluationRequests } from "./api/evaluationRequests";
import { listProjects } from "./api/projects";
import App from "./App";
import { AuthProvider } from "./store/AuthContext";
import { RoleProvider } from "./store/RoleContext";

vi.mock("./api/auth", () => ({
  getSession: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));
vi.mock("./api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("./api/projects", () => ({ listProjects: vi.fn() }));

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

  test.each(["/login", "/register", "/privacy", "/terms"])(
    "links to both legal pages from %s",
    async (path) => {
      renderAt(path);

      const footer = within(await screen.findByRole("contentinfo"));

      expect(footer.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
        "/privacy",
      );
      expect(footer.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe(
        "/terms",
      );
    },
  );

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
