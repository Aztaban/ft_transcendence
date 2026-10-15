import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ProjectOverview from "./ProjectOverview";

afterEach(() => {
  cleanup();
});

function project(slug: string, name: string) {
  return { id: 1, slug, name, eligible_tutors: [] };
}

describe("ProjectOverview", () => {
  it("shows the topics, project info and tested items of a known project", () => {
    render(<ProjectOverview project={project("push_swap", "push_swap")} />);

    expect(screen.getByText("Project topics")).toBeTruthy();
    expect(screen.getByText("Move optimization", { selector: "li" })).toBeTruthy();
    expect(screen.getAllByText("12.5%")).toHaveLength(8);
    expect(screen.getByText("45 min")).toBeTruthy();
    expect(screen.getByText("42 Prague")).toBeTruthy();
    expect(screen.getByText("Algorithm choice")).toBeTruthy();
  });

  it("says when the topics of a project haven't been added yet", () => {
    render(<ProjectOverview project={project("codexion", "Codexion")} />);

    expect(screen.getByText("Topics for this project haven't been added yet.")).toBeTruthy();
    expect(screen.getByText("Not added yet.")).toBeTruthy();
    expect(screen.queryByText("Estimated duration")).toBeNull();
    expect(screen.getByText("42 Prague")).toBeTruthy();
  });
});

describe("topicIcon", () => {
  it("picks an icon from the topic's name, with a fallback", async () => {
    const { topicIcon } = await import("./topicIcons");

    expect(topicIcon("Code quality")).toBe(topicIcon("Builtins"));
    expect(topicIcon("Error handling")).toBe(topicIcon("Firewall"));
    expect(topicIcon("Stacks")).not.toBe(topicIcon("Error handling"));
    expect(topicIcon("Something new")).toBe(topicIcon("Another thing"));
  });
});
