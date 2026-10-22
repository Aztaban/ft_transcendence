import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { createEligibilityRequest } from "../../api/eligibility";
import { listProjects } from "../../api/projects";
import WelcomeHitchhikerDialog from "./WelcomeHitchhikerDialog";

vi.mock("../../api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("../../api/eligibility", () => ({ createEligibilityRequest: vi.fn() }));

const projects = [
  { id: 1, slug: "born2beroot", name: "born2beroot" },
  { id: 2, slug: "minishell", name: "minishell" },
  { id: 3, slug: "push_swap", name: "push_swap" },
];

beforeEach(() => {
  vi.mocked(listProjects).mockResolvedValue(projects);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function getButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("WelcomeHitchhikerDialog", () => {
  it("asks to mark the projects, with Submit disabled until one is marked", async () => {
    render(<WelcomeHitchhikerDialog onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Welcome Hitchhiker" })).toBeTruthy();
    expect(screen.getByText("Please, mark all the projects you can evaluate")).toBeTruthy();
    expect(getButton("Submit").disabled).toBe(true);

    fireEvent.click(await screen.findByRole("checkbox", { name: "push_swap" }));

    expect(getButton("Submit").disabled).toBe(false);
  });

  it("sends the marked projects in API order and shows Form sent!", async () => {
    vi.mocked(createEligibilityRequest).mockResolvedValue({
      id: 9,
      requester: { id: 2, display_name: "dkolarov", avatar_url: null },
      projects: [projects[0], projects[2]],
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      review_note: "",
      created_at: "2026-10-13T08:00:00Z",
    });
    const onClose = vi.fn();
    render(<WelcomeHitchhikerDialog onClose={onClose} />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "push_swap" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "born2beroot" }));
    fireEvent.click(getButton("Submit"));

    expect(await screen.findByRole("dialog", { name: "Form sent!" })).toBeTruthy();
    expect(createEligibilityRequest).toHaveBeenCalledWith({ project_ids: [1, 3] });

    fireEvent.click(screen.getByTestId("welcome-dialog-backdrop"));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows the error and stays open when the request fails", async () => {
    vi.mocked(createEligibilityRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "eligibility_request_pending"),
    );
    render(<WelcomeHitchhikerDialog onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "minishell" }));
    fireEvent.click(getButton("Submit"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You already have a request waiting for review.",
    );
    expect(screen.getByRole("dialog", { name: "Welcome Hitchhiker" })).toBeTruthy();
  });

  it("closes with Not now or Escape", async () => {
    const onClose = vi.fn();
    render(<WelcomeHitchhikerDialog onClose={onClose} />);
    await screen.findByRole("checkbox", { name: "minishell" });

    fireEvent.click(getButton("Not now"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
