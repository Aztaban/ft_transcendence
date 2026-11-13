import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { countPeople, searchPeople } from "../api/people";
import { listProjects } from "../api/projects";
import i18n from "../i18n";
import type { PersonResult } from "../types/people";
import HitchhikersPage from "./HitchhikersPage";

const workspace = vi.hoisted(() => ({ activeRole: "STUDENT" }));

vi.mock("../api/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/people")>()),
  countPeople: vi.fn(),
  searchPeople: vi.fn(),
}));
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
  avatar_url: "/avatar.png",
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

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{location.search}</output>;
}

function renderPage(path = "/hitchhikers") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/hitchhikers"
          element={
            <>
              <HitchhikersPage />
              <LocationProbe />
            </>
          }
        />
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
    expect(document.title).toBe("Hitchhikers · 42 Evals");
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

    expect(lenkaCard.querySelector("img")?.getAttribute("src")).toBe("/avatar.png");
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
      within(screen.getByRole("note", { name: "How it works" }))
        .getByRole("link", { name: /Create a request/ })
        .getAttribute("href"),
    ).toBe("/requests");
  });

  it("does not offer a new request outside the student workspace", async () => {
    workspace.activeRole = "COUNCIL";
    renderPage();
    await findCard("Psimcak");

    expect(screen.getByRole("note", { name: "How it works" })).toBeTruthy();
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

// "Who" and the top bar's search (api-plan §10.8): Hitchhikers, the Student Council, or everyone.
describe("HitchhikersPage people search", () => {
  function LocationProbe() {
    const location = useLocation();
    const navigate = useNavigate();

    return (
      <>
        <output data-testid="url">{location.search}</output>
        <button type="button" onClick={() => navigate("/hitchhikers?q=mjusta&role=all")}>
          Top bar search
        </button>
      </>
    );
  }

  function renderWithUrl(path = "/hitchhikers") {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/hitchhikers"
            element={
              <>
                <HitchhikersPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  function who() {
    return screen.getByRole("combobox", { name: "Who" }) as HTMLSelectElement;
  }

  it("finds the Student Council or everyone with Who, and keeps it in the URL", async () => {
    renderWithUrl();
    await findCard("Psimcak");

    expect(who().value).toBe("tutor");

    fireEvent.change(who(), { target: { value: "sc_member" } });

    await waitFor(() => expect(searchedWith()?.role).toBe("sc_member"));
    expect(screen.getByTestId("url").textContent).toBe("?role=sc_member");

    fireEvent.change(who(), { target: { value: "all" } });

    await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("?role=all"));
    expect(searchedWith()).toEqual({
      role: undefined,
      q: undefined,
      project: undefined,
      ordering: "display_name",
      page: 1,
    });
    await waitFor(() =>
      expect(document.getElementById("hitchhikers-search-hint")?.textContent).toBe("2 people"),
    );
  });

  it("reads the top bar's search from the URL: a name, for everyone", async () => {
    renderWithUrl("/hitchhikers?q=lenka&role=all");
    await findCard("Psimcak");

    expect(searchedWith()).toMatchObject({ role: undefined, q: "lenka" });
    expect(who().value).toBe("all");
    expect(
      (screen.getByRole("searchbox", { name: "Search people by name" }) as HTMLInputElement).value,
    ).toBe("lenka");
  });

  it("takes a new name from the top bar while the page is open", async () => {
    renderWithUrl("/hitchhikers?q=lenka&role=all");
    await findCard("Psimcak");

    fireEvent.click(screen.getByRole("button", { name: "Top bar search" }));

    await waitFor(() => expect(searchedWith()?.q).toBe("mjusta"));
    expect(
      (screen.getByRole("searchbox", { name: "Search people by name" }) as HTMLInputElement).value,
    ).toBe("mjusta");

    // After the search box's pause, the URL still has the new name, not the old one.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByTestId("url").textContent).toBe("?q=mjusta&role=all");
  });

  it("keeps Who when it changes right after typing a name", async () => {
    renderWithUrl();
    await findCard("Psimcak");

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ps" } });
    fireEvent.change(who(), { target: { value: "sc_member" } });

    // The name's timer fires after Who changed: it must not write the old URL back.
    await waitFor(() => expect(searchedWith()).toMatchObject({ role: "sc_member", q: "ps" }));
    expect(who().value).toBe("sc_member");
    expect(screen.getByTestId("url").textContent).toBe("?role=sc_member&q=ps");
  });

  it("starts a top bar search from the first page after Show more", async () => {
    vi.mocked(searchPeople)
      .mockResolvedValueOnce(resultPage([psimcak, lenka], 3, "/api/v1/search/people/?page=2"))
      .mockResolvedValueOnce(resultPage([mjusta], 3))
      .mockResolvedValue(resultPage([lenka]));
    renderWithUrl("/hitchhikers?role=all");
    await findCard("Psimcak");
    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));
    await findCard("Mjusta");

    fireEvent.click(screen.getByRole("button", { name: "Top bar search" }));

    // Only the new search's first page: nothing of the old list is kept.
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Psimcak" })).toBeNull());
    expect(searchedWith()).toMatchObject({ q: "mjusta", page: 1 });
    expect(screen.queryByRole("heading", { name: "Mjusta" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Lenka Husarova" })).toBeTruthy();
  });

  it("says nobody was found, not no Hitchhikers, outside the Hitchhikers", async () => {
    vi.mocked(searchPeople).mockResolvedValue(resultPage([]));
    renderPage("/hitchhikers?q=zz&role=sc_member");

    expect(await screen.findByRole("heading", { name: "Nobody found" })).toBeTruthy();
  });

  // Only Hitchhikers are eligible for projects, so the Student Council and a project never match.
  it("offers no project for the Student Council and drops the chosen one", async () => {
    renderWithUrl("/hitchhikers?project=born2beroot");
    await findCard("Psimcak");

    expect(searchedWith()?.project).toBe("born2beroot");

    fireEvent.change(who(), { target: { value: "sc_member" } });

    await waitFor(() => expect(screen.getByTestId("url").textContent).toBe("?role=sc_member"));
    expect(searchedWith()).toMatchObject({ role: "sc_member", project: undefined });
    expect(screen.queryByRole("combobox", { name: /Project/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /born2beroot/ })).toBeNull();

    fireEvent.change(who(), { target: { value: "all" } });

    expect(await screen.findByRole("combobox", { name: /Project/ })).toBeTruthy();
  });

  it("ignores a project in a shared link for the Student Council", async () => {
    renderWithUrl("/hitchhikers?role=sc_member&project=born2beroot");
    await findCard("Psimcak");

    expect(searchedWith()).toMatchObject({ role: "sc_member", project: undefined });
  });

  it("goes back to the Hitchhikers on Clear filters after a top bar search", async () => {
    vi.mocked(searchPeople).mockResolvedValue(resultPage([]));
    renderWithUrl("/hitchhikers?q=zz&role=all");

    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));

    await waitFor(() => expect(screen.getByTestId("url").textContent).toBe(""));
    expect(who().value).toBe("tutor");
    await waitFor(() =>
      expect(searchedWith()).toMatchObject({ role: "tutor", q: undefined, project: undefined }),
    );
  });
});

// Search interface (#361): what the user sees and keeps while searching (api-plan §10.8).
describe("HitchhikersPage search interface", () => {
  function searchBox() {
    return screen.getByRole("searchbox", { name: "Search Hitchhikers by name" });
  }

  function status() {
    return document.getElementById("hitchhikers-search-hint")?.textContent;
  }

  it("ignores an older answer that arrives after a newer search", async () => {
    let answerOld: (value: ReturnType<typeof resultPage>) => void = () => {};

    vi.mocked(searchPeople).mockImplementation(async ({ q } = {}) => {
      if (q === "le") {
        return new Promise((resolve) => {
          answerOld = resolve;
        });
      }

      return q === "len" ? resultPage([lenka]) : resultPage([psimcak, lenka]);
    });
    renderPage();
    await findCard("Psimcak");

    fireEvent.change(searchBox(), { target: { value: "le" } });
    await waitFor(() => expect(searchedWith()?.q).toBe("le"));
    fireEvent.change(searchBox(), { target: { value: "len" } });
    await waitFor(() => expect(searchedWith()?.q).toBe("len"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Psimcak" })).toBeNull());

    await act(async () => answerOld(resultPage([psimcak, mjusta])));

    expect(screen.getByRole("heading", { name: "Lenka Husarova" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Psimcak" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Mjusta" })).toBeNull();
  });

  it("ignores an older search that fails while a newer one is running", async () => {
    let failOld: (reason: Error) => void = () => {};
    let answerNew: (value: ReturnType<typeof resultPage>) => void = () => {};

    renderPage();
    await findCard("Psimcak");
    vi.mocked(searchPeople).mockImplementation(
      ({ q } = {}) =>
        new Promise((resolve, reject) => {
          if (q === "le") {
            failOld = reject;
          } else {
            answerNew = resolve;
          }
        }),
    );

    fireEvent.change(searchBox(), { target: { value: "le" } });
    await waitFor(() => expect(searchedWith()?.q).toBe("le"));
    fireEvent.change(searchBox(), { target: { value: "len" } });
    await waitFor(() => expect(searchedWith()?.q).toBe("len"));

    await act(async () => failOld(new Error("network")));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(status()).toBe("Searching…");

    await act(async () => answerNew(resultPage([lenka])));

    expect(status()).toBe("1 Hitchhiker");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the results while a new search runs and announces the outcome", async () => {
    let answer: (value: ReturnType<typeof resultPage>) => void = () => {};

    renderPage();
    await findCard("Psimcak");

    expect(status()).toBe("2 Hitchhikers");
    // Screen readers announce the status line when it changes.
    expect(document.getElementById("hitchhikers-search-hint")?.getAttribute("aria-live")).toBe(
      "polite",
    );

    vi.mocked(searchPeople).mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    fireEvent.change(searchBox(), { target: { value: "lenka" } });

    await waitFor(() => expect(status()).toBe("Searching…"));
    expect(screen.getByRole("heading", { name: "Psimcak" })).toBeTruthy();
    expect(screen.getByRole("list", { busy: true })).toBeTruthy();

    await act(async () => answer(resultPage([lenka])));

    expect(status()).toBe("1 Hitchhiker");
    expect(screen.queryByRole("heading", { name: "Psimcak" })).toBeNull();
  });

  it("starts again from the first page when a filter changes after Show more", async () => {
    vi.mocked(searchPeople)
      .mockResolvedValueOnce(resultPage([psimcak, lenka], 3, "/api/v1/search/people/?page=2"))
      .mockResolvedValueOnce(resultPage([mjusta], 3))
      .mockResolvedValue(resultPage([psimcak]));
    renderPage();
    await findCard("Psimcak");
    fireEvent.click(screen.getByRole("button", { name: "Show more (1 left)" }));
    await findCard("Mjusta");

    fireEvent.change(screen.getByRole("combobox", { name: /Project/ }), {
      target: { value: "born2beroot" },
    });

    await waitFor(() => expect(searchedWith()).toMatchObject({ project: "born2beroot", page: 1 }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Mjusta" })).toBeNull());
  });

  it("shows the server's message when the search is not valid", async () => {
    // §10.8 allows 2–64 characters; a shared link can still carry a longer name.
    const tooLong = "a".repeat(65);

    vi.mocked(searchPeople).mockRejectedValue(
      new ApiError(400, "Invalid input.", "validation_error", {
        q: ["Ensure this field has no more than 64 characters."],
      }),
    );
    renderPage(`/hitchhikers?q=${tooLong}`);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Ensure this field has no more than 64 characters.",
    );
    expect(searchedWith()?.q).toBe(tooLong);
  });

  it("still searches when the project list cannot be loaded", async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error("network"));
    renderPage();

    expect(await findCard("Psimcak")).toBeTruthy();
    expect(searchedWith()).toEqual({
      role: "tutor",
      q: undefined,
      project: undefined,
      ordering: "display_name",
      page: 1,
    });
  });

  it("sorts A to Z when the URL has an unknown ordering", async () => {
    renderPage("/hitchhikers?ordering=email");
    await findCard("Psimcak");

    expect(searchedWith()?.ordering).toBe("display_name");
    expect((screen.getByRole("combobox", { name: /Sort/ }) as HTMLSelectElement).value).toBe(
      "display_name",
    );
  });

  it("puts the typed name and the sort in the URL, so a search can be shared", async () => {
    renderPage();
    await findCard("Psimcak");

    fireEvent.change(searchBox(), { target: { value: "  lenka " } });
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("?q=lenka"));

    fireEvent.change(screen.getByRole("combobox", { name: /Sort/ }), {
      target: { value: "-display_name" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("?q=lenka&ordering=-display_name"),
    );

    // A to Z is the default, so it leaves the URL.
    fireEvent.change(screen.getByRole("combobox", { name: /Sort/ }), {
      target: { value: "display_name" },
    });
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("?q=lenka"));

    fireEvent.change(screen.getByRole("combobox", { name: /Sort/ }), {
      target: { value: "-display_name" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("?q=lenka&ordering=-display_name"),
    );

    fireEvent.change(searchBox(), { target: { value: "" } });
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("?ordering=-display_name"),
    );
  });
});

describe("HitchhikersPage in another language", () => {
  it("shows the search, the role pills and the counts in Czech", async () => {
    await i18n.changeLanguage("cs");
    renderPage();

    const card = await findCard("Psimcak");

    expect(screen.getByRole("heading", { level: 1, name: "Hitchhikeři" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Hledat podle jména")).toBeTruthy();
    expect(within(card).getByText("2 projekty")).toBeTruthy();
    expect(within(await findCard("Lenka Husarova")).getByText("Studentská rada")).toBeTruthy();
    expect(screen.getByText("2 Hitchhikeři")).toBeTruthy();
  });

  it("shows the error in the language chosen after it happened", async () => {
    vi.mocked(searchPeople).mockRejectedValue(
      new ApiError(429, "Request was throttled.", "throttled"),
    );
    renderPage();

    expect(
      await screen.findByText("Too many searches in a short time. Wait a moment and try again."),
    ).toBeTruthy();

    await act(async () => {
      await i18n.changeLanguage("cs");
    });

    expect(
      screen.getByText("Příliš mnoho hledání v krátké době. Chvíli počkejte a zkuste to znovu."),
    ).toBeTruthy();
  });
});
