import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listProjects } from "../../api/projects";
import ProjectSelect from "./ProjectSelect";

vi.mock("../../api/projects", () => ({ listProjects: vi.fn() }));

const projects = [
  { id: 1, slug: "born2beroot", name: "born2beroot" },
  { id: 2, slug: "push_swap", name: "push_swap" },
];

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("ProjectSelect", () => {
  it("shows a loading state until the projects arrive", () => {
    vi.mocked(listProjects).mockReturnValue(new Promise(() => {}));

    render(<ProjectSelect value={null} onChange={() => {}} />);

    expect(screen.getByText("Loading projects…")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("lists the projects from the API as choices", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);

    render(<ProjectSelect value={null} onChange={() => {}} />);

    expect(await screen.findByRole("radio", { name: "push_swap" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "born2beroot" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Choose the project" })).toBeTruthy();
  });

  it("reports the chosen project id and project", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    const onChange = vi.fn();

    render(<ProjectSelect value={null} onChange={onChange} />);
    fireEvent.click(await screen.findByRole("radio", { name: "push_swap" }));

    expect(onChange).toHaveBeenCalledWith(2, projects[1]);
  });

  it("marks the selected project", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);

    render(<ProjectSelect value={2} onChange={() => {}} />);

    const pushSwap = (await screen.findByRole("radio", { name: "push_swap" })) as HTMLInputElement;
    const born2beroot = screen.getByRole("radio", { name: "born2beroot" }) as HTMLInputElement;

    expect(pushSwap.checked).toBe(true);
    expect(born2beroot.checked).toBe(false);
  });

  it("shows an error when the projects cannot be loaded", async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error("network"));

    render(<ProjectSelect value={null} onChange={() => {}} />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the projects. Please try again later.",
    );
  });

  it("says when there are no projects", async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    render(<ProjectSelect value={null} onChange={() => {}} />);

    expect(await screen.findByText("No projects available")).toBeTruthy();
  });
});
