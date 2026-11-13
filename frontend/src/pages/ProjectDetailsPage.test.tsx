import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getProject } from "../api/projects";
import ProjectDetailsPage from "./ProjectDetailsPage";

vi.mock("../api/projects", () => ({ getProject: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderPage(slug = "push_swap") {
  return render(
    <MemoryRouter initialEntries={[`/projects/${slug}`]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailsPage", () => {
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

  // #369: screen readers hear what is loading, not only an empty busy block.
  it("says that the project is loading", () => {
    vi.mocked(getProject).mockReturnValue(new Promise(() => {}));

    renderPage();

    const label = screen.getByText("Loading the project…");

    expect(label.closest("[aria-busy='true']")).toBeTruthy();
  });

  it("explains a missing or inactive project (404)", async () => {
    vi.mocked(getProject).mockRejectedValue(new ApiError(404, "Not found.", "not_found"));

    renderPage("libft");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This project does not exist or is not open for evaluations.",
    );
  });

  it("shows a general error for other failures, and loads again on Try again", async () => {
    vi.mocked(getProject).mockRejectedValue(new Error("network"));

    renderPage();

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText("Could not load the project. Please try again.")).toBeTruthy();

    vi.mocked(getProject).mockResolvedValue({
      id: 4,
      slug: "push_swap",
      name: "push_swap",
      eligible_tutors: [],
    });
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "push_swap" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
