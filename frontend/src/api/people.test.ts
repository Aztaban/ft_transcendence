import { afterEach, describe, expect, test, vi } from "vitest";

import { countPeople, searchPeople } from "./people";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const page = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 42,
      display_name: "Bob",
      avatar_url: null,
      roles: [
        { id: 1, name: "student" },
        { id: 2, name: "tutor" },
      ],
      eligible_projects: [{ id: 4, slug: "push_swap", name: "push_swap" }],
    },
  ],
};

describe("people API", () => {
  test("searches without parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(page));

    expect(await searchPeople()).toEqual(page);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/search/people/");
  });

  test("sends the filters, the ordering and the page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(page));

    await searchPeople({
      q: "bo b",
      role: "tutor",
      project: "push_swap",
      ordering: "-display_name",
      page: 2,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/search/people/?q=bo+b&role=tutor&project=push_swap&ordering=-display_name&page=2",
    );
  });

  test("leaves out empty filters and the first page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(page));

    await searchPeople({ q: "", project: "", page: 1 });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/search/people/");
  });

  test("counts the people with a role", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ...page, count: 12 }));

    expect(await countPeople("head_tutor")).toBe(12);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/search/people/?role=head_tutor");
  });
});
