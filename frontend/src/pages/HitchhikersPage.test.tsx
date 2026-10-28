import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { countPeople, searchPeople } from "../api/people";
import { listProjects } from "../api/projects";
import type { PersonResult } from "../types/people";
import HitchhikersPage from "./HitchhikersPage";

const workspace = vi.hoisted(() => ({ activeRole: "STUDENT" }));

vi.mock("../api/people", () => ({ countPeople: vi.fn(), searchPeople: vi.fn() }));
vi.mock("../api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("../store/RoleContext", () => ({ useRole: () => workspace }));

const born2beroot = { id: 1, slug: "born2beroot", name: "born2beroot" };
const pushSwap = { id: 2, slug: "push_swap", name: "push_swap" };

const psimcak: PersonResult = {
  id: 7,
  display_name: "Psimcak",
  avatar_url: null,
  roles: [
    { id: 1, name: "student" },
    { id: 2, name: "tutor" },
  ],
  eligible_projects: [born2beroot, pushSwap],
};

const lenka: PersonResult = {
  id: 9,
  display_name: "Lenka Husarova",
  avatar_url: "/api/v1/files/3/download/",
  roles: [
    { id: 1, name: "student" },
    { id: 3, name: "head_tutor" },
    { id: 4, name: "sc_member" },
  ],
  eligible_projects: [],
};

const mjusta: PersonResult = { ...psimcak, id: 11, display_name: "Mjusta" };

function resultPage(results: PersonResult[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

beforeEach(() => {
  vi.mocked(listProjects).mockResolvedValue([born2beroot, pushSwap]);
  vi.mocked(searchPeople).mockResolvedValue(resultPage([psimcak, lenka]));
  vi.mocked(countPeople).mockImplementation(async (role) => (role === "tutor" ? 7 : 2));
});

afterEach(() => {
  workspace.activeRole = "STUDENT";
  cleanup();
  vi.resetAllMocks();
});

function renderPage(path = "/hitchhikers") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/hitchhikers" element={<HitchhikersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function findCard(name: string) {
  return (await screen.findByRole("heading", { name })).closest("li") as HTMLElement;
}

function searchedWith() {
  return vi.mocked(searchPeople).mock.lastCall?.[0];
}

describe("HitchhikersPage", () => {
  it("lists the Hitchhikers with their roles and the projects they can evaluate", async () => {
    renderPage();

    const card = await findCard("Psimcak");

    expect(searchPeople).toHaveBeenCalledTimes(1);
    expect(searchedWith()).toEqual({
      role: "tutor",
      q: undefined,
      project: undefined,
      ordering: "display_name",
      page: 1,
    });
    expect(screen.getByText("2 Hitchhikers")).toBeTruthy();

    expect(within(card).getByText("PS")).toBeTruthy();
    expect(
      within(within(card).getByRole("list", { name: "Roles" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Hitchhiker"]);
    expect(within(card).getByText("born2beroot")).toBeTruthy();
    expect(within(card).getByText("push_swap")).toBeTruthy();
    expect(within(card).getByText("2 projects")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Psimcak" }).getAttribute("href")).toBe(
      "/people/7",
    );

    const lenkaCard = await findCard("Lenka Husarova");

    expect(lenkaCard.querySelector("img")?.getAttribute("src")).toBe("/api/v1/files/3/download/");
    expect(
      within(within(lenkaCard).getByRole("list", { name: "Roles" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Head Tutor", "Student Council"]);
    expect(within(lenkaCard).getByText("No projects yet.")).toBeTruthy();
  });

  it("shows how many Hitchhikers, Head Tutors and projects there are", async () => {
    renderPage();
    await findCard("Psimcak");

    const tiles = within(screen.getByRole("list", { name: "Overview" })).getAllByRole("listitem");

    await waitFor(() =>
      expect(tiles.map((tile) => tile.textContent)).toEqual([
        "7Hitchhikers",
        "2Head Tutors",
        "2Projects to evaluate",
      ]),
    );
    expect(vi.mocked(countPeople).mock.calls).toEqual([["tutor"], ["head_tutor"]]);
  });

  it("shows dashes in the overview when the counts cannot be loaded", async () => {
    vi.mocked(countPeople).mockRejectedValue(new ApiError(500, "Server error"));
    vi.mocked(listProjects).mockRejectedValue(new ApiError(500, "Server error"));
    renderPage();
    await findCard("Psimcak");

    expect(
      within(screen.getByRole("list", { name: "Overview" }))
        .getAllByRole("listitem")
        .map((tile) => tile.textContent),
    ).toEqual(["—Hitchhikers", "—Head Tutors", "—Projects to evaluate"]);
  });

  it("explains how it works and links students to a new request", async () => {
    renderPage();
    await findCard("Psimcak");

    expect(
      within(screen.getByRole("complementary", { name: "How it works" }))
        .getByRole("link", { name: /Create a request/ })
        .getAttribute("href"),
    ).toBe("/requests");
  });

  it("does not offer a new request outside the student workspace", async () => {
    workspace.activeRole = "COUNCIL";
    renderPage();
    await findCard("Psimcak");

    expect(screen.getByRole("complementary", { name: "How it works" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Create a request/ })).toBeNull();
  });

  it("searches by name after a pause, from 2 characters on", async () => {
    renderPage();
    await findCard("Psimcak");
    const input = screen.getByRole("searchbox", { name: "Search Hitchhikers by name" });

    fireEvent.change(input, { target: { value: "p" } });

    expect(screen.getByText("Type at least 2 characters to search by name.")).toBeTruthy();

    fireEvent.change(input, { target: { value: "ps " } });

    await waitFor(() => expect(searchedWith()?.q).toBe("ps"));
    expect(vi.mocked(searchPeople).mock.calls.map(([params]) => params?.q)).toEqual([
      undefined,
      "ps",
    ]);
  });

  it("filters by project and highlights it on the cards", async () => {
    renderPage();
    await findCard("Psimcak");

    fireEvent.change(screen.getByRole("combobox", { name: /Project/ }), {
      target: { value: "push_swap" },
    });

    await waitFor(() => expect(searchedWith()?.project).toBe("push_swap"));
    expect(searchedWith()?.page).toBe(1);
    expect(
      within(await findCard("Psimcak"))
        .getByText("push_swap")
        .closest("li")?.className,
    ).toBe("hitchhiker-card__project--match");
  });

  it("sorts by name from Z to A", async () => {
    renderPage();
    await findCard("Psimcak");

    fireEvent.change(screen.getByRole("combobox", { name: /Sort/ }), {
      target: { value: "-display_name" },
    });

    await waitFor(() => expect(searchedWith()?.ordering).toBe("-display_name"));
  });

  it("reads the filters from the URL", async () => {
    renderPage("/hitchhikers?q=lenka&project=push_swap&ordering=-display_name");
    await findCard("Psimcak");

    expect(searchedWith()).toEqual({
      role: "tutor",
      q: "lenka",
      project: "push_swap",
      ordering: "-display_name",
      page: 1,
    });
    expect(
      (screen.getByRole("searchbox", { name: "Search Hitchhikers by name" }) as HTMLInputElement)
        .value,
    ).toBe("lenka");
  });

  it("shows the active filters and removes one of them", async () => {
    renderPage("/hitchhikers?q=lenka&project=push_swap");
    await findCard("Psimcak");

    fireEvent.click(screen.getByRole("button", { name: "Remove the project filter push_swap" }));

    await waitFor(() => expect(searchedWith()?.project).toBeUndefined());
    expect(searchedWith()?.q).toBe("lenka");
    expect(screen.queryByRole("button", { name: /Remove the project filter/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: 'Remove the name filter "lenka"' }));

    await waitFor(() => expect(searchedWith()?.q).toBeUndefined());
    expect(
      (screen.getByRole("searchbox", { name: "Search Hitchhikers by name" }) as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("says when nothing matches and clears the filters", async () => {
    vi.mocked(searchPeople).mockResolvedValueOnce(resultPage([]));
    renderPage("/hitchhikers?q=zz&project=push_swap");

    expect(await screen.findByRole("heading", { name: "No Hitchhikers found" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await findCard("Psimcak");
    expect(searchedWith()).toEqual({
      role: "tutor",
      q: undefined,
      project: undefined,
      ordering: "display_name",
      page: 1,
    });
    expect(
      (screen.getByRole("searchbox", { name: "Search Hitchhikers by name" }) as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("says when there are no Hitchhikers at all", async () => {
    vi.mocked(searchPeople).mockResolvedValueOnce(resultPage([]));
    renderPage();

    expect(await screen.findByRole("heading", { name: "No Hitchhikers yet" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("shows an error and loads again on Try again", async () => {
    vi.mocked(searchPeople).mockRejectedValueOnce(new ApiError(500, "Server error"));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load the Hitchhikers. Please try again.Try again",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await findCard("Psimcak")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains the rate limit", async () => {
    vi.mocked(searchPeople).mockRejectedValueOnce(
      new ApiError(429, "Request was throttled.", "throttled"),
    );
    renderPage();

    expect(
      await screen.findByText("Too many searches in a short time. Wait a moment and try again."),
    ).toBeTruthy();
  });

  it("shows more Hitchhikers and retries the same page after a failure", async () => {
    vi.mocked(searchPeople)
      .mockResolvedValueOnce(resultPage([psimcak, lenka], 3, "/api/v1/search/people/?page=2"))
      .mockRejectedValueOnce(new ApiError(500, "Server error"))
      .mockResolvedValueOnce(resultPage([mjusta], 3));
    renderPage();
    await findCard("Psimcak");

    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load more Hitchhikers. Please try again.",
    );
    expect(screen.getByRole("heading", { name: "Lenka Husarova" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));

    expect(await findCard("Mjusta")).toBeTruthy();
    expect(vi.mocked(searchPeople).mock.calls.map(([params]) => params?.page)).toEqual([1, 2, 2]);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
