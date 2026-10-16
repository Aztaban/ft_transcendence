import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listProjects } from "../../api/projects";
import ProjectMultiSelect from "./ProjectMultiSelect";

vi.mock("../../api/projects", () => ({ listProjects: vi.fn() }));

const projects = [
  { id: 1, slug: "born2beroot", name: "born2beroot" },
  { id: 2, slug: "minishell", name: "minishell" },
  { id: 3, slug: "push_swap", name: "push_swap" },
];

function renderInRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("ProjectMultiSelect", () => {
  it("shows a loading state until the projects arrive", () => {
    vi.mocked(listProjects).mockReturnValue(new Promise(() => {}));

    renderInRouter(<ProjectMultiSelect value={[]} onChange={() => {}} />);

    expect(screen.getByText("Loading projects…")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("lists the projects as checkboxes with a counter", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);

    renderInRouter(<ProjectMultiSelect value={[projects[1]]} onChange={() => {}} />);

    const minishell = (await screen.findByRole("checkbox", {
      name: "minishell",
    })) as HTMLInputElement;

    expect(minishell.checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "push_swap" }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect(screen.getByText("1 of 3 selected")).toBeTruthy();
  });

  it("adds and removes projects, keeping the API order", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    const onChange = vi.fn();

    renderInRouter(<ProjectMultiSelect value={[projects[2]]} onChange={onChange} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "born2beroot" }));

    expect(onChange).toHaveBeenLastCalledWith([projects[0], projects[2]]);

    fireEvent.click(screen.getByRole("checkbox", { name: "push_swap" }));

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("selects all projects, then clears them", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    const onChange = vi.fn();

    const { rerender } = renderInRouter(<ProjectMultiSelect value={[]} onChange={onChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "Select all" }));

    expect(onChange).toHaveBeenLastCalledWith(projects);

    rerender(
      <MemoryRouter>
        <ProjectMultiSelect value={projects} onChange={onChange} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("links each project to its details page without selecting it", async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    const onChange = vi.fn();

    renderInRouter(<ProjectMultiSelect value={[]} onChange={onChange} />);
    const link = await screen.findByRole("link", { name: "Details about push_swap" });

    expect(link.getAttribute("href")).toBe("/projects/push_swap");

    fireEvent.click(link);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an error when the projects cannot be loaded", async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error("network"));

    renderInRouter(<ProjectMultiSelect value={[]} onChange={() => {}} />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the projects. Please try again later.",
    );
  });
});
