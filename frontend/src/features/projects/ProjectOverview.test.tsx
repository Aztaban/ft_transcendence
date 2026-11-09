import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import en from "../../i18n/locales/en.json";
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

  it("shows a new core project from its subject", () => {
    render(<ProjectOverview project={project("fly-in", "Fly-In")} />);

    expect(screen.getByText("Pathfinding", { selector: "li" })).toBeTruthy();
    expect(screen.getAllByText("12.5%")).toHaveLength(8);
    expect(screen.getByText("Turn count against the targets")).toBeTruthy();
  });

  it("says when the topics of a project haven't been added yet", () => {
    render(<ProjectOverview project={project("libft", "Libft")} />);

    expect(screen.getByText("Topics for this project haven't been added yet.")).toBeTruthy();
    expect(screen.getByText("Not added yet.")).toBeTruthy();
    expect(screen.queryByText("Estimated duration")).toBeNull();
    expect(screen.getByText("42 Prague")).toBeTruthy();
  });
});

describe("ProjectOverview in another language", () => {
  it("shows the topics and tested items in Czech, with the same icons as in English", async () => {
    const { container } = render(<ProjectOverview project={project("push_swap", "push_swap")} />);
    const englishIcons = [...container.querySelectorAll(".topics-chart__icon")].map((icon) =>
      icon.getAttribute("d"),
    );

    cleanup();
    await i18n.changeLanguage("cs");
    const czech = render(<ProjectOverview project={project("push_swap", "push_swap")} />);

    expect(screen.getByText("Optimalizace tahů", { selector: "li" })).toBeTruthy();
    expect(screen.getByText("Volba algoritmu")).toBeTruthy();
    expect(screen.queryByText("Move optimization", { selector: "li" })).toBeNull();
    expect(
      [...czech.container.querySelectorAll(".topics-chart__icon")].map((icon) =>
        icon.getAttribute("d"),
      ),
    ).toEqual(englishIcons);
  });

  it("shows a new core project in Spanish", async () => {
    await i18n.changeLanguage("es");

    render(<ProjectOverview project={project("fly-in", "Fly-In")} />);

    expect(screen.getByText("Búsqueda de rutas", { selector: "li" })).toBeTruthy();
    expect(screen.getByText("Número de turnos frente a los objetivos")).toBeTruthy();
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

  it("has a real icon for every topic of every project", async () => {
    const { topicIcon } = await import("./topicIcons");
    const fallback = topicIcon("Something new");
    // Icons are picked from the English names, whatever the language.
    const topics = Object.values(en.projectContent).flatMap((content) => content.topics);

    expect(topics.filter((topic) => topicIcon(topic) === fallback)).toEqual([]);
  });
});
