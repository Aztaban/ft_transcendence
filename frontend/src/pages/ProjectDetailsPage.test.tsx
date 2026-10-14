import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getProject } from "../api/projects";
import ProjectDetailsPage from "./ProjectDetailsPage";

vi.mock("../api/projects", () => ({ getProject: vi.fn() }));

const session = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));

vi.mock("../store/AuthContext", () => ({
  useAuth: () => ({
    user: session.isAuthenticated ? { id: 1, email: "a@42.cz", display_name: "dkolarov" } : null,
    isAuthenticated: session.isAuthenticated,
    isLoading: session.isLoading,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  session.isAuthenticated = true;
  session.isLoading = false;
});

function renderPage(slug = "push_swap") {
  return render(
    <MemoryRouter initialEntries={[`/projects/${slug}`]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectDetailsPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailsPage", () => {
  it("does not call the project endpoint while the session is loading", () => {
    session.isLoading = true;
    session.isAuthenticated = false;

    renderPage();

    expect(getProject).not.toHaveBeenCalled();
    expect(screen.queryByText("Login page")).toBeNull();
  });

  it("sends a logged-out user to the login page without calling the endpoint", () => {
    session.isAuthenticated = false;

    renderPage();

    expect(screen.getByText("Login page")).toBeTruthy();
    expect(getProject).not.toHaveBeenCalled();
  });

  it("sends the user to the login page when the session expired (401)", async () => {
    vi.mocked(getProject).mockRejectedValue(
      new ApiError(401, "Not logged in.", "not_authenticated"),
    );

    renderPage();

    expect(await screen.findByText("Login page")).toBeTruthy();
  });

  it("shows the project with its info", async () => {
    vi.mocked(getProject).mockResolvedValue({
      id: 4,
      slug: "push_swap",
      name: "push_swap",
      eligible_tutors: [
        { id: 2, display_name: "dkolarov", avatar_url: null },
        { id: 3, display_name: "mjusta", avatar_url: null },
      ],
    });

    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "push_swap" })).toBeTruthy();
    expect(getProject).toHaveBeenCalledWith("push_swap");
    expect(screen.getByText("42 Prague")).toBeTruthy();
  });

  it("explains a missing or inactive project (404)", async () => {
    vi.mocked(getProject).mockRejectedValue(new ApiError(404, "Not found.", "not_found"));

    renderPage("libft");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This project does not exist or is not open for evaluations.",
    );
  });

  it("shows a general error for other failures", async () => {
    vi.mocked(getProject).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the project. Please try again later.",
    );
  });
});
