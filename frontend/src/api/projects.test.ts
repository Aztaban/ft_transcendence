import { afterEach, describe, expect, test, vi } from "vitest";

import { getProject, listProjects } from "./projects";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("projects API", () => {
  test("lists the active projects", async () => {
    const projects = [{ id: 1, slug: "push_swap", name: "push_swap" }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(projects));

    expect(await listProjects()).toEqual(projects);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/projects/");
  });

  test("gets one project by its slug", async () => {
    const project = { id: 1, slug: "push_swap", name: "push_swap", eligible_tutors: [] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(project));

    expect(await getProject("push_swap")).toEqual(project);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/projects/push_swap/");
  });
});
