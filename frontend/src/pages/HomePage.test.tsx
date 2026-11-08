import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
const data = vi.hoisted(() => ({
  overview: {} as Record<string, Paginated<EvaluationRequest>>,
  unread: [] as SCMessage[],
  unreadCount: 0,
  totalCount: 0,
  hitchhikerCount: 0 as number | null,
}));

// The student boxes load data from the API; that is tested in OpenRequests and the hook itself.
vi.mock("../features/hitchhiker/useHitchhikerRequests", () => ({
  useHitchhikerRequests: () => ({ openRequests: [], pickedRequests: [], ...load }),
}));
vi.mock("../features/student/useStudentRequests", () => ({
  useStudentRequests: () => ({ requests: [], ...load, reload: vi.fn() }),
}));
vi.mock("../features/home/useRequestOverview", () => ({
  useRequestOverview: () => data.overview,
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

  it("shows the student call to action for students", () => {
    renderHomeAs("STUDENT");

    expect(screen.getByText("Need an evaluation?")).toBeTruthy();
    expect(screen.getByText("Student")).toBeTruthy();
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

  it("leaves a box without a number when its list has not answered", () => {
    data.overview = { open: list(2) };
    renderHomeAs("STUDENT");

    expect(within(overviewBox("Open requests")).getByText("2")).toBeTruthy();
    expect(within(overviewBox("Completed")).getByText("—")).toBeTruthy();
    expect(within(overviewBox("Next evaluation")).getByText("—")).toBeTruthy();
  });

  it("shows the Hitchhiker's real totals", () => {
    data.overview = { open: list(35), awaiting: list(2), done: list(12) };
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
