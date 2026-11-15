import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  // #369: placeholders and a text for screen readers instead of an empty box.
  it("shows placeholders while the projects load", async () => {
    render(<WelcomeHitchhikerDialog onClose={() => {}} />);

    const projectBox = screen.getByRole("group", { name: "Projects" });

    expect(projectBox.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Loading projects…")).toBeTruthy();

    expect(await screen.findByRole("checkbox", { name: /minishell/ })).toBeTruthy();
    expect(projectBox.getAttribute("aria-busy")).toBe("false");
    expect(screen.queryByText("Loading projects…")).toBeNull();
  });

  // #370: an empty list says so, instead of an empty box.
  it("says when there is no project to choose", async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    render(<WelcomeHitchhikerDialog onClose={() => {}} />);

    expect(await screen.findByText("No projects available")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Projects" }).getAttribute("aria-busy")).toBe("false");
    expect(getButton("Submit").disabled).toBe(true);
  });

  it("says when the projects cannot be loaded, with Submit disabled, and loads again", async () => {
    vi.mocked(listProjects).mockRejectedValueOnce(new Error("network"));
    render(<WelcomeHitchhikerDialog onClose={() => {}} />);

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText("Could not load the projects. Please try again.")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(getButton("Submit").disabled).toBe(true);

    // #371: Try again shows the placeholders, then the projects.
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Loading projects…")).toBeTruthy();
    expect(await screen.findByRole("checkbox", { name: /minishell/ })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("unmarks a project on a second click and sends only the marked ones", async () => {
    vi.mocked(createEligibilityRequest).mockResolvedValue({
      id: 9,
      requester: { id: 2, display_name: "dkolarov", avatar_url: null },
      projects: [projects[1]],
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      review_note: "",
      created_at: "2026-10-13T08:00:00Z",
    });
    render(<WelcomeHitchhikerDialog onClose={() => {}} />);

    const pushSwap = (await screen.findByRole("checkbox", {
      name: "push_swap",
    })) as HTMLInputElement;

    fireEvent.click(pushSwap);
    fireEvent.click(pushSwap);
    expect(pushSwap.checked).toBe(false);
    expect(getButton("Submit").disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "minishell" }));
    fireEvent.click(getButton("Submit"));

    expect(await screen.findByRole("dialog", { name: "Form sent!" })).toBeTruthy();
    expect(createEligibilityRequest).toHaveBeenCalledWith({ project_ids: [2] });
  });

  it("keeps Form sent! open on a click inside it", async () => {
    vi.mocked(createEligibilityRequest).mockResolvedValue({
      id: 9,
      requester: { id: 2, display_name: "dkolarov", avatar_url: null },
      projects: [projects[2]],
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      review_note: "",
      created_at: "2026-10-13T08:00:00Z",
    });
    const onClose = vi.fn();
    render(<WelcomeHitchhikerDialog onClose={onClose} />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "push_swap" }));
    fireEvent.click(getButton("Submit"));
    fireEvent.click(await screen.findByRole("dialog", { name: "Form sent!" }));

    expect(onClose).not.toHaveBeenCalled();
  });

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

  // #371: closing during the request used to drop "Form sent!" or the error.
  it("stays open while the request is on its way", async () => {
    const onClose = vi.fn();

    vi.mocked(createEligibilityRequest).mockReturnValue(new Promise(() => {}));
    render(<WelcomeHitchhikerDialog onClose={onClose} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /minishell/ }));
    fireEvent.click(getButton("Submit"));

    expect(getButton("Not now").disabled).toBe(true);
    fireEvent.click(getButton("Not now"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
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
