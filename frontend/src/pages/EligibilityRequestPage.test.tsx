import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { createEligibilityRequest } from "../api/eligibility";
import { listProjects } from "../api/projects";
import EligibilityRequestPage from "./EligibilityRequestPage";

vi.mock("../api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("../api/eligibility", () => ({ createEligibilityRequest: vi.fn() }));

const projects = [
  { id: 1, slug: "born2beroot", name: "born2beroot" },
  { id: 2, slug: "minishell", name: "minishell" },
  { id: 3, slug: "push_swap", name: "push_swap" },
];

const sentRequest = {
  id: 9,
  requester: { id: 2, display_name: "dkolarov", avatar_url: null },
  projects: [projects[0], projects[2]],
  status: "pending" as const,
  reviewed_by: null,
  reviewed_at: null,
  review_note: "",
  created_at: "2026-10-13T08:00:00Z",
};

beforeEach(() => {
  vi.mocked(listProjects).mockResolvedValue(projects);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/eligibility-requests/new"]}>
      <Routes>
        <Route path="/eligibility-requests/new" element={<EligibilityRequestPage />} />
        <Route path="/requests" element={<div>Requests page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function chooseProjects(...names: string[]) {
  for (const name of names) {
    fireEvent.click(await screen.findByRole("checkbox", { name }));
  }
}

function getButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("EligibilityRequestPage", () => {
  it("starts on step 1 with Next disabled until a project is chosen", async () => {
    renderPage();

    expect(screen.getByText("Step 1 / 2 · Select projects")).toBeTruthy();
    expect(getButton("Next").disabled).toBe(true);

    await chooseProjects("push_swap");

    expect(getButton("Next").disabled).toBe(false);
  });

  it("explains how eligibility works next to the form", async () => {
    renderPage();
    await screen.findByRole("checkbox", { name: "push_swap" });

    const panel = screen.getByRole("heading", { name: "How it works" })
      .parentElement as HTMLElement;

    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Choose your projectsSelect every project you want to evaluate.",
      "A Head Tutor reviewsThey approve or decline the whole request.",
      "Start evaluatingOnce approved, pick open requests for these projects.",
    ]);
  });

  it("lists the chosen projects on the confirmation step and can go back", async () => {
    renderPage();
    await chooseProjects("push_swap", "born2beroot");

    fireEvent.click(getButton("Next"));

    expect(screen.getByRole("heading", { name: "2 projects selected" })).toBeTruthy();
    expect(
      within(screen.getByRole("article"))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["born2beroot", "push_swap"]);

    fireEvent.click(getButton("Edit"));

    expect(screen.getByText("Step 1 / 2 · Select projects")).toBeTruthy();
  });

  it("sends one request with every chosen project and shows the popup", async () => {
    vi.mocked(createEligibilityRequest).mockResolvedValue(sentRequest);
    renderPage();
    await chooseProjects("push_swap", "born2beroot");
    fireEvent.click(getButton("Next"));

    fireEvent.click(getButton("Submit"));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(createEligibilityRequest).toHaveBeenCalledWith({ project_ids: [1, 3] });

    fireEvent.click(screen.getByTestId("eligibility-dialog-backdrop"));

    expect(screen.getByText("Requests page")).toBeTruthy();
  });

  it("explains when a request is already waiting for review", async () => {
    vi.mocked(createEligibilityRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "eligibility_request_pending"),
    );
    renderPage();
    await chooseProjects("push_swap");
    fireEvent.click(getButton("Next"));

    fireEvent.click(getButton("Submit"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You already have a request waiting for review.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the field message from a 400 on project_ids", async () => {
    vi.mocked(createEligibilityRequest).mockRejectedValue(
      new ApiError(400, "Invalid input.", "validation_error", {
        project_ids: ["You are already eligible for push_swap."],
      }),
    );
    renderPage();
    await chooseProjects("push_swap");
    fireEvent.click(getButton("Next"));

    fireEvent.click(getButton("Submit"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You are already eligible for push_swap.",
    );
  });
});
