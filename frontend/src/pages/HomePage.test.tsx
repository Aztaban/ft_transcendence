import { cleanup, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "../features/student/testUtils";
import i18n from "../i18n";
import { RoleProvider, useRole, type AppRole } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import type { SCMessage } from "../types/scMessage";
import HomePage from "./HomePage";

// What the mocked hooks report; each test may change it before rendering.
const load = vi.hoisted(() => ({ isLoading: false, hasError: false }));
const data = vi.hoisted(() => ({
  requests: [] as EvaluationRequest[],
  openRequests: [] as EvaluationRequest[],
  pickedRequests: [] as EvaluationRequest[],
  unread: [] as SCMessage[],
  unreadCount: 0,
  totalCount: 0,
  hitchhikerCount: 0,
}));

// The student boxes load data from the API; that is tested in OpenRequests and the hook itself.
vi.mock("../features/hitchhiker/useHitchhikerRequests", () => ({
  useHitchhikerRequests: () => ({
    openRequests: data.openRequests,
    pickedRequests: data.pickedRequests,
    ...load,
  }),
}));
vi.mock("../features/student/useStudentRequests", () => ({
  useStudentRequests: () => ({ requests: data.requests, ...load, reload: vi.fn() }),
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
  data.requests = [];
  data.openRequests = [];
  data.pickedRequests = [];
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
  it("shows the student call to action for students", () => {
    renderHomeAs("STUDENT");

    expect(screen.getByText("Need an evaluation?")).toBeTruthy();
    expect(screen.getByText("Student")).toBeTruthy();
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

describe("HomePage overview", () => {
  it("counts the student's real requests and shows the soonest evaluation", () => {
    const later = {
      ...makeRequest(1, "minishell", "confirmed"),
      starts_at: "2026-11-20T10:00:00Z",
      ends_at: "2026-11-20T10:45:00Z",
    };
    const sooner = {
      ...makeRequest(2, "push_swap", "confirmed"),
      starts_at: "2026-11-10T10:00:00Z",
      ends_at: "2026-11-10T10:45:00Z",
    };
    const passed = {
      ...makeRequest(3, "cpp09", "confirmed"),
      is_history: true,
      result: "passed" as const,
    };

    data.requests = [
      later,
      sooner,
      passed,
      makeRequest(4, "born2beroot", "pending"),
      makeRequest(5, "Fly-In", "awaiting_confirmation"),
      makeRequest(6, "Codexion", "cancelled"),
    ];
    renderHomeAs("STUDENT");

    expect(within(overviewBox("Pending")).getByText("2")).toBeTruthy();
    expect(within(overviewBox("Completed")).getByText("1")).toBeTruthy();
    expect(within(overviewBox("Next evaluation")).getByText(/10 Nov/)).toBeTruthy();
  });

  it("says when no evaluation is scheduled", () => {
    renderHomeAs("STUDENT");

    expect(within(overviewBox("Next evaluation")).getByText("Not scheduled")).toBeTruthy();
    expect(within(overviewBox("Pending")).getByText("0")).toBeTruthy();
  });

  it("shows no number while the requests load or after an error", () => {
    load.isLoading = true;
    renderHomeAs("STUDENT");

    expect(within(overviewBox("Pending")).getByText("—")).toBeTruthy();
    expect(within(overviewBox("Next evaluation")).getByText("—")).toBeTruthy();
  });

  it("counts the Hitchhiker's real requests", () => {
    data.openRequests = [makeRequest(1, "minishell", "pending")];
    data.pickedRequests = [
      makeRequest(2, "push_swap", "awaiting_confirmation"),
      makeRequest(3, "cpp09", "awaiting_confirmation"),
      { ...makeRequest(4, "Fly-In", "confirmed"), is_history: true, result: "failed" as const },
    ];
    renderHomeAs("HITCHHIKER");

    expect(within(overviewBox("Open requests")).getByText("1")).toBeTruthy();
    expect(within(overviewBox("Awaiting confirmation")).getByText("2")).toBeTruthy();
    expect(within(overviewBox("Evaluations done")).getByText("1")).toBeTruthy();
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
    expect(within(overviewBox("History")).getByText("3")).toBeTruthy();
    expect(within(overviewBox("Hitchhikers")).getByText("9")).toBeTruthy();
    expect(screen.getByText("The fridge is broken.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read message #7" }).getAttribute("href")).toBe(
      "/council/inbox/7",
    );
    expect(screen.getByText("View Messages", { selector: "a" }).getAttribute("href")).toBe(
      "/council/inbox",
    );
  });

  it("says when there is nothing to read", () => {
    renderHomeAs("COUNCIL");

    expect(screen.getByText("No messages yet")).toBeTruthy();
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
    expect(screen.getByText("Potřebujete hodnocení?")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Otevřené žádosti" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Čekající hodnocení" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Nová žádost/ })).toBeTruthy();
  });
});
