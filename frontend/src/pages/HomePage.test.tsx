import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "../features/student/testUtils";
import i18n from "../i18n";
import { RoleProvider, useRole, type AppRole } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import type { Paginated } from "../types/pagination";
import type { SCMessage } from "../types/scMessage";
import HomePage from "./HomePage";

// What the mocked hooks report; each test may change it before rendering.
const load = vi.hoisted(() => ({ isLoading: false, hasError: false }));
// The real roles from /users/me/, and the `enabled` each list hook was last called with.
const currentUser = vi.hoisted(() => ({ roles: [] as string[], isLoaded: false }));
const enabledWith = vi.hoisted(() => ({
  hitchhiker: undefined as boolean | undefined,
  overview: undefined as boolean | undefined,
}));
const data = vi.hoisted(() => ({
  overview: {} as Record<string, Paginated<EvaluationRequest>>,
  unread: [] as SCMessage[],
  unreadCount: 0,
  totalCount: 0,
  hitchhikerCount: 0 as number | null,
  openCount: null as number | null,
  // What the list hooks give the boxes: the student's requests, the Hitchhiker's open queue and
  // the requests the Hitchhiker picked.
  studentRequests: [] as EvaluationRequest[],
  openRequests: [] as EvaluationRequest[],
  pickedRequests: [] as EvaluationRequest[],
}));

// The student boxes load data from the API; that is tested in OpenRequests and the hook itself.
vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));
vi.mock("../features/hitchhiker/useHitchhikerRequests", () => ({
  useHitchhikerRequests: (enabled?: boolean) => {
    enabledWith.hitchhiker = enabled;

    return {
      openRequests: data.openRequests,
      openCount: data.openCount,
      pickedRequests: data.pickedRequests,
      ...load,
    };
  },
}));
vi.mock("../features/student/useStudentRequests", () => ({
  useStudentRequests: () => ({ requests: data.studentRequests, ...load, reload: vi.fn() }),
}));
vi.mock("../features/home/useRequestOverview", () => ({
  useRequestOverview: (_queries: unknown, _events: unknown, enabled: boolean) => {
    enabledWith.overview = enabled;

    return data.overview;
  },
}));
vi.mock("../features/home/useCouncilOverview", () => ({
  useCouncilOverview: () => ({
    unread: data.unread,
    unreadCount: data.unreadCount,
    totalCount: data.totalCount,
    hitchhikerCount: data.hitchhikerCount,
    ...load,
  }),
}));

afterEach(() => {
  cleanup();
  // The active workspace is kept for the tab; each test starts as a student.
  sessionStorage.clear();
  load.isLoading = false;
  load.hasError = false;
  data.overview = {};
  data.unread = [];
  data.unreadCount = 0;
  data.totalCount = 0;
  data.hitchhikerCount = 0;
  data.openCount = null;
  data.studentRequests = [];
  data.openRequests = [];
  data.pickedRequests = [];
  vi.useRealTimers();
  currentUser.roles = [];
  currentUser.isLoaded = false;
  enabledWith.hitchhiker = undefined;
  enabledWith.overview = undefined;
});

// Switches the active role, as the role selector in the sidebar does.
function SwitchRole({ role }: { role: AppRole }) {
  const { setActiveRole } = useRole();

  useEffect(() => {
    setActiveRole(role);
  }, [role, setActiveRole]);

  return null;
}

function renderHomeAs(role: AppRole) {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <SwitchRole role={role} />
        <HomePage />
      </RoleProvider>
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  it("sends the Administration workspace to Users", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <RoleProvider>
          <SwitchRole role="ADMIN" />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/manage/users" element={<p>Users page</p>} />
          </Routes>
        </RoleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Users page")).toBeTruthy();
    expect(screen.queryByText("Need an evaluation?")).toBeNull();
  });

  // A Hitchhiker workspace restored from the tab is only trusted once /users/me/ has the role.
  it("asks for no Hitchhiker list until the role is confirmed", () => {
    const view = renderHomeAs("HITCHHIKER");

    expect(screen.getByText("Ready to evaluate?")).toBeTruthy();
    expect(enabledWith).toEqual({ hitchhiker: false, overview: false });

    currentUser.roles = ["student", "tutor"];
    currentUser.isLoaded = true;
    view.rerender(
      <MemoryRouter>
        <RoleProvider>
          <HomePage />
        </RoleProvider>
      </MemoryRouter>,
    );

    expect(enabledWith).toEqual({ hitchhiker: true, overview: true });
  });

  it("loads the student numbers without waiting for /users/me/", () => {
    renderHomeAs("STUDENT");

    expect(currentUser.isLoaded).toBe(false);
    expect(enabledWith.overview).toBe(true);
  });

  it("shows the student call to action for students", () => {
    renderHomeAs("STUDENT");

    expect(screen.getByText("Need an evaluation?")).toBeTruthy();
    expect(screen.getByText("Student")).toBeTruthy();
    expect(screen.getByRole("link", { name: "New Request" }).getAttribute("href")).toBe(
      "/requests",
    );
    expect(document.title).toBe("Home · 42 Evals");
  });

  it("shows the Hitchhiker dashboard for Hitchhikers", () => {
    renderHomeAs("HITCHHIKER");

    expect(screen.getByText("Ready to evaluate?")).toBeTruthy();
    expect(screen.getByText("Hitchhiker")).toBeTruthy();
    expect(screen.getByText("Open requests")).toBeTruthy();
    expect(screen.getByText("Awaiting confirmation")).toBeTruthy();
    expect(screen.getByText("Open Requests", { selector: "a" }).getAttribute("href")).toBe(
      "/requests",
    );
    expect(screen.queryByText("Need an evaluation?")).toBeNull();
  });

  it("shows the four Hitchhiker sections instead of the placeholders", () => {
    renderHomeAs("HITCHHIKER");

    for (const title of [
      "Open Requests",
      "Awaiting Confirmation",
      "Upcoming Evaluations",
      "History",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
    }
    expect(screen.queryByText("No history yet")).toBeTruthy();
    expect(screen.queryByText("Your recent activity will appear here.")).toBeNull();
  });

  it("shows skeletons instead of empty states while the student's requests load", () => {
    load.isLoading = true;
    renderHomeAs("STUDENT");

    expect(screen.getByText("Loading your requests…")).toBeTruthy();
    expect(screen.getByText("Loading scheduled evaluations…")).toBeTruthy();
    expect(screen.getByText("Loading your history…")).toBeTruthy();
    expect(screen.queryByText("No open requests")).toBeNull();
  });

  it("shows skeletons in all four Hitchhiker boxes while loading", () => {
    load.isLoading = true;
    renderHomeAs("HITCHHIKER");

    expect(screen.getByText("Loading open requests…")).toBeTruthy();
    expect(screen.getByText("Loading proposed slots…")).toBeTruthy();
    expect(screen.getByText("Loading scheduled evaluations…")).toBeTruthy();
    expect(screen.getByText("Loading your history…")).toBeTruthy();
  });

  it("shows only the error when the first load fails, without empty states", () => {
    load.hasError = true;
    renderHomeAs("HITCHHIKER");

    expect(screen.getByRole("alert").textContent).toBe(
      "Could not load your requests. Please try again later.",
    );
    expect(screen.queryByText("No open requests")).toBeNull();
    expect(screen.queryByText("No history yet")).toBeNull();
  });

  it("shows only the error when a student's requests cannot be loaded", () => {
    load.hasError = true;
    renderHomeAs("STUDENT");

    expect(screen.getByRole("alert").textContent).toBe(
      "Could not load your requests. Please try again later.",
    );
    expect(screen.queryByRole("region", { name: "Open Requests" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Pending Evaluations" })).toBeNull();
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
    // The way on stays: the call to action does not need the list.
    expect(screen.getByText("Need an evaluation?")).toBeTruthy();
  });
});

// The rows of a Home box, as [project, what the row's status column says].
function rowsIn(box: string) {
  const region = screen.getByRole("region", { name: box });

  return within(region)
    .queryAllByRole("article")
    .map((row) => [
      within(row).getByRole("heading", { level: 3 }).textContent,
      row.querySelector(".dashboard-request__status")?.textContent,
    ]);
}

// The projects listed in a Home box, in their order.
function projectsIn(box: string) {
  return rowsIn(box).map(([project]) => project);
}

// The dashboard hands one list to several boxes, and each box keeps its own requests (#360).
describe("HomePage boxes", () => {
  it("puts each of the student's requests in its box", () => {
    data.studentRequests = [
      makeRequest(1, "minishell", "pending"),
      makeRequest(2, "push_swap", "awaiting_confirmation"),
      makeRequest(3, "libft", "confirmed"),
      { ...makeRequest(4, "ft_printf", "confirmed"), is_history: true, result: "passed" },
      makeRequest(5, "so_long", "cancelled"),
      makeRequest(6, "pipex", "expired"),
    ];
    renderHomeAs("STUDENT");

    // A proposed slot waits for the student's answer, so it comes first.
    expect(rowsIn("Open Requests")).toEqual([
      ["push_swap", "Needs your confirmation"],
      ["minishell", "Pending"],
    ]);
    expect(projectsIn("Pending Evaluations")).toEqual(["libft"]);
    expect(rowsIn("History")).toEqual([
      ["ft_printf", "Passed"],
      ["so_long", "Cancelled"],
      ["pipex", "Expired"],
    ]);
  });

  it("puts each of the Hitchhiker's requests in its box", () => {
    // The open queue is its own list (scope=open); the other boxes share the picked requests.
    data.openRequests = [{ ...makeRequest(11, "minishell", "pending"), student: null }];
    data.pickedRequests = [
      makeRequest(12, "push_swap", "awaiting_confirmation"),
      makeRequest(13, "libft", "confirmed"),
      { ...makeRequest(14, "ft_printf", "confirmed"), is_history: true, result: "failed" },
      { ...makeRequest(15, "so_long", "confirmed"), is_history: true },
    ];
    renderHomeAs("HITCHHIKER");

    expect(rowsIn("Open Requests")).toEqual([["minishell", "Open"]]);
    expect(rowsIn("Awaiting Confirmation")).toEqual([["push_swap", "Waiting for student"]]);
    expect(projectsIn("Upcoming Evaluations")).toEqual(["libft"]);
    // An ended evaluation without a result yet is history too, waiting for its result.
    expect(rowsIn("History")).toEqual([
      ["ft_printf", "Failed"],
      ["so_long", "Result pending"],
    ]);
  });
});

function overviewBox(label: string) {
  const overview = within(screen.getByRole("region", { name: "Overview" }));

  return overview.getByText(label).closest("article") as HTMLElement;
}

function list(count: number, results: EvaluationRequest[] = []) {
  return { count, next: null, previous: null, results };
}

function evaluation(id: number, startsAt: string, endsAt: string) {
  return { ...makeRequest(id, "push_swap", "confirmed"), starts_at: startsAt, ends_at: endsAt };
}

describe("HomePage overview", () => {
  it("shows the student's real totals, not what fits on one page", () => {
    data.overview = { open: list(35), completed: list(8), upcoming: list(0) };
    renderHomeAs("STUDENT");

    expect(within(overviewBox("Open requests")).getByText("35")).toBeTruthy();
    expect(within(overviewBox("Completed")).getByText("8")).toBeTruthy();
    expect(within(overviewBox("Next evaluation")).getByText("Not scheduled")).toBeTruthy();
  });

  it("shows the soonest evaluation that has not ended", () => {
    data.overview = {
      upcoming: list(2, [
        evaluation(1, "2020-11-03T10:00:00Z", "2020-11-03T10:45:00Z"),
        evaluation(2, "2099-11-10T10:00:00Z", "2099-11-10T10:45:00Z"),
      ]),
    };
    renderHomeAs("STUDENT");

    expect(within(overviewBox("Next evaluation")).getByText(/10 Nov/)).toBeTruthy();
  });

  // No event fires when an evaluation ends: the page looks at the clock once a minute.
  it("moves on to the next evaluation once the current one has ended", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-11-12T10:30:00Z"));
    data.overview = {
      upcoming: list(2, [
        evaluation(1, "2026-11-12T10:00:00Z", "2026-11-12T10:45:00Z"),
        evaluation(2, "2026-11-20T10:00:00Z", "2026-11-20T10:45:00Z"),
      ]),
    };
    renderHomeAs("STUDENT");

    // The running evaluation is still the next one until it ends.
    expect(within(overviewBox("Next evaluation")).getByText(/12 Nov/)).toBeTruthy();

    act(() => vi.advanceTimersByTime(15 * 60 * 1000));
    expect(within(overviewBox("Next evaluation")).getByText(/20 Nov/)).toBeTruthy();

    // Eight days later, without running the timer for each of those minutes: the next tick sees it.
    act(() => {
      vi.setSystemTime(new Date("2026-11-20T10:45:00Z"));
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(within(overviewBox("Next evaluation")).getByText("Not scheduled")).toBeTruthy();
  });

  it("leaves a box without a number when its list has not answered", () => {
    data.overview = { open: list(2) };
    renderHomeAs("STUDENT");

    expect(within(overviewBox("Open requests")).getByText("2")).toBeTruthy();
    expect(within(overviewBox("Completed")).getByText("—")).toBeTruthy();
    expect(within(overviewBox("Next evaluation")).getByText("—")).toBeTruthy();
  });

  it("shows the Hitchhiker's real totals", () => {
    // The open queue's total comes with the queue; the other two from the overview lists.
    data.openCount = 35;
    data.overview = { awaiting: list(2), done: list(12) };
    renderHomeAs("HITCHHIKER");

    expect(within(overviewBox("Open requests")).getByText("35")).toBeTruthy();
    expect(within(overviewBox("Awaiting confirmation")).getByText("2")).toBeTruthy();
    expect(within(overviewBox("Evaluations done")).getByText("12")).toBeTruthy();
  });
});

describe("HomePage banner", () => {
  it("stays paused when the workspace changes", () => {
    function Switch() {
      const { setActiveRole } = useRole();

      return (
        <button type="button" onClick={() => setActiveRole("HITCHHIKER")}>
          Switch
        </button>
      );
    }

    render(
      <MemoryRouter>
        <RoleProvider>
          <Switch />
          <HomePage />
        </RoleProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause animation" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));

    expect(screen.getByText("Ready to evaluate?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play animation" })).toBeTruthy();
  });
});

describe("HomePage for the Student Council", () => {
  it("shows the real numbers and links to the unread messages", () => {
    data.unread = [
      {
        id: 7,
        body: "The fridge is broken.",
        read_at: null,
        discussion_note: "",
        discussion_note_version: 0,
        created_at: "2026-10-17T08:00:00Z",
      },
    ];
    data.unreadCount = 1;
    data.totalCount = 4;
    data.hitchhikerCount = 9;
    renderHomeAs("COUNCIL");

    expect(within(overviewBox("New messages")).getByText("1")).toBeTruthy();
    expect(within(overviewBox("History")).getByText("4")).toBeTruthy();
    expect(within(overviewBox("Hitchhikers")).getByText("9")).toBeTruthy();
    expect(screen.getByText("The fridge is broken.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read message #7" }).getAttribute("href")).toBe(
      "/council/inbox/7",
    );
    expect(screen.getByText("View Messages", { selector: "a" }).getAttribute("href")).toBe(
      "/council/inbox",
    );
  });

  it("says when the council has no messages at all", () => {
    renderHomeAs("COUNCIL");

    expect(screen.getByText("No messages yet")).toBeTruthy();
  });

  it("says everything is read when only read messages exist", () => {
    data.totalCount = 4;
    renderHomeAs("COUNCIL");

    expect(screen.getByText("All caught up!")).toBeTruthy();
    expect(screen.queryByText("No messages yet")).toBeNull();
  });

  it("leaves only the Hitchhiker box empty when its count is missing", () => {
    data.totalCount = 4;
    data.hitchhikerCount = null;
    renderHomeAs("COUNCIL");

    expect(within(overviewBox("History")).getByText("4")).toBeTruthy();
    expect(within(overviewBox("Hitchhikers")).getByText("—")).toBeTruthy();
  });

  it("shows only the error when the messages cannot be loaded", () => {
    load.hasError = true;
    renderHomeAs("COUNCIL");

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No messages yet")).toBeNull();
  });
});

describe("HomePage in another language", () => {
  it("shows the student dashboard in Czech", async () => {
    await i18n.changeLanguage("cs");
    renderHomeAs("STUDENT");

    expect(screen.getByRole("heading", { name: "Vítejte zpět" })).toBeTruthy();
    expect(document.title).toBe("Domů · 42 Evals");
    expect(screen.getByText("Potřebujete hodnocení?")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Otevřené žádosti" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Čekající hodnocení" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Nová žádost/ })).toBeTruthy();
  });
});
