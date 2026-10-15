import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listProjects } from "../../api/projects";
import ProjectSelect from "./ProjectSelect";

vi.mock("../../api/projects", () => ({ listProjects: vi.fn() }));

const projects = [
  { id: 1, slug: "born2beroot", name: "born2beroot" },
  { id: 2, slug: "push_swap", name: "push_swap" },
];

function getSelect() {
  return screen.getByLabelText("Choose the project") as HTMLSelectElement;
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("ProjectSelect", () => {
  it("shows a loading state until the projects arrive", () => {
    vi.mocked(listProjects).mockReturnValue(new Promise(() => {}));

    render(<ProjectSelect value={null} onChange={() => {}} />);

    expect(getSelect().disabled).toBe(true);
    expect(screen.getByText("Loading projects…")).toBeTruthy();
  });

  it("lists the projects from the API", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);

    render(<ProjectSelect value={null} onChange={() => {}} />);

    expect(await screen.findByRole("option", { name: "push_swap" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "born2beroot" })).toBeTruthy();
    expect(getSelect().disabled).toBe(false);
  });

  it("reports the chosen project id", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    const onChange = vi.fn();

    render(<ProjectSelect value={null} onChange={onChange} />);
    await screen.findByRole("option", { name: "push_swap" });
    fireEvent.change(getSelect(), { target: { value: "2" } });

    expect(onChange).toHaveBeenCalledWith(2);
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
    expect(getSelect().disabled).toBe(true);
  });
});
