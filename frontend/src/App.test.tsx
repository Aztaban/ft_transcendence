import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
