import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listEvaluationRequests } from "../api/evaluationRequests";
import { listProjects } from "../api/projects";
import { makeRequest } from "../features/student/testUtils";
import { RoleProvider, useRole } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import { LiveContext } from "../websocket/LiveProvider";
import { FakeSocket, openLiveSocket } from "../websocket/testSocket";
import HistoryPage from "./HistoryPage";

vi.mock("../api/evaluationRequests", () => ({ listEvaluationRequests: vi.fn() }));
vi.mock("../api/projects", () => ({ listProjects: vi.fn() }));

const projects = [
  { id: 1, slug: "born2beroot", name: "born2beroot" },
  { id: 2, slug: "push_swap", name: "push_swap" },
];

function past(id: number, name: string, extra: Partial<EvaluationRequest> = {}) {
  return { ...makeRequest(id, name, "confirmed"), is_history: true, ...extra };
}

function page(results: EvaluationRequest[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

function SwitchToHitchhiker() {
  const { setActiveRole } = useRole();

  return (
    <button type="button" onClick={() => setActiveRole("HITCHHIKER")}>
      switch
    </button>
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <SwitchToHitchhiker />
        <HistoryPage />
      </RoleProvider>
    </MemoryRouter>,
  );
}

function cardOf(name: string) {
  return screen.getByRole("heading", { name }).closest("li") as HTMLElement;
}

beforeEach(() => {
  vi.mocked(listProjects).mockResolvedValue(projects);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  // The active workspace is kept for the tab; each test starts as a student.
  sessionStorage.clear();
});

describe("HistoryPage", () => {
  it("loads the student's history", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderPage();

    expect(await screen.findByText("No history yet")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledWith({
      scope: "mine",
      history: true,
      status: undefined,
      project: undefined,
      page: 1,
    });
  });

  it("loads the Hitchhiker's picked history", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderPage();
    await screen.findByText("No history yet");
    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    await screen.findByText("The evaluations you picked in the past.");
    expect(listEvaluationRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: "picked", history: true }),
    );
  });

  it("shows the outcome, the other person, the end note and the feedback", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([
        past(1, "push_swap", {
          result: "passed",
          feedback: "Clean and well explained.",
          completed_at: "2026-10-12T18:00:00Z",
        }),
        past(2, "minishell", { result: "failed" }),
        past(3, "cpp09"),
        {
          ...makeRequest(4, "born2beroot", "cancelled"),
          cancelled_by: { id: 1, display_name: "dkolarov", avatar_url: null },
        },
        makeRequest(5, "Fly-In", "expired"),
      ]),
    );

    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    expect(within(cardOf("push_swap")).getByText("Passed")).toBeTruthy();
    expect(within(cardOf("push_swap")).getByText("Hitchhiker: Hitchhiker")).toBeTruthy();
    expect(within(cardOf("push_swap")).getByText(/^Result recorded on /)).toBeTruthy();
    expect(within(cardOf("push_swap")).getByText("Clean and well explained.")).toBeTruthy();
    expect(within(cardOf("minishell")).getByText("Failed")).toBeTruthy();
    expect(within(cardOf("cpp09")).getByText("Result pending")).toBeTruthy();
    expect(within(cardOf("born2beroot")).getByText(/^Cancelled by dkolarov on /)).toBeTruthy();
    expect(within(cardOf("Fly-In")).getByText("Expired")).toBeTruthy();
    expect(within(cardOf("Fly-In")).getByText(/^Requested on /)).toBeTruthy();
  });

  it("shows no student to a Hitchhiker when the API hides it (R15)", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([{ ...makeRequest(5, "Fly-In", "expired"), student: null }]),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    await screen.findByText("The evaluations you picked in the past.");

    expect(within(cardOf("Fly-In")).queryByText(/^Student: /)).toBeNull();
    expect(within(cardOf("Fly-In")).getByText("Expired")).toBeTruthy();
  });

  it("filters by status and project, going back to page 1", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([past(1, "push_swap")]));

    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });
    await screen.findByRole("option", { name: "push_swap" });

    fireEvent.click(screen.getByRole("button", { name: "Cancelled" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Project" }), {
      target: { value: "push_swap" },
    });

    await screen.findByRole("heading", { name: "push_swap" });
    expect(listEvaluationRequests).toHaveBeenLastCalledWith({
      scope: "mine",
      history: true,
      status: ["cancelled"],
      project: "push_swap",
      page: 1,
    });
    expect(screen.getByRole("button", { name: "Cancelled" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("filters by result: passed, failed and result pending", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([past(1, "push_swap")]));

    renderPage();
    await screen.findByRole("heading", { name: "push_swap" });

    expect(
      within(screen.getByRole("group", { name: "Filter by outcome" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All", "Passed", "Failed", "Result pending", "Cancelled", "Expired"]);

    fireEvent.click(screen.getByRole("button", { name: "Passed" }));

    await vi.waitFor(() =>
      expect(listEvaluationRequests).toHaveBeenLastCalledWith({
        scope: "mine",
        history: true,
        status: ["confirmed"],
        result: ["passed"],
        project: undefined,
        page: 1,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    await vi.waitFor(() =>
      expect(listEvaluationRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: ["confirmed"], result: ["failed"] }),
      ),
    );

    // §10.4: "Result pending" is a finished evaluation without a recorded result.
    fireEvent.click(screen.getByRole("button", { name: "Result pending" }));

    await vi.waitFor(() =>
      expect(listEvaluationRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: ["confirmed"], result: ["none"] }),
      ),
    );
    expect(
      screen.getByRole("button", { name: "Result pending" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("says when the filters match nothing", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(page([]));

    renderPage();
    await screen.findByText("No history yet");
    fireEvent.click(screen.getByRole("button", { name: "Expired" }));

    expect(await screen.findByText("Nothing matches these filters")).toBeTruthy();
  });

  it("pages through the history", async () => {
    vi.mocked(listEvaluationRequests).mockResolvedValue(
      page([past(1, "push_swap")], 45, "https://localhost/api/v1/evaluation-requests/?page=2"),
    );

    renderPage();

    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("shows an error when the history cannot be loaded", async () => {
    vi.mocked(listEvaluationRequests).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not load your history. Please try again later.",
    );
  });
});

describe("HistoryPage live", () => {
  afterEach(() => {
    FakeSocket.reset();
  });

  it("re-fetches the same page in the background when an evaluation changes", async () => {
    vi.mocked(listEvaluationRequests)
      .mockResolvedValueOnce(page([past(1, "push_swap")]))
      .mockResolvedValueOnce(page([past(2, "minishell"), past(1, "push_swap")]));

    render(
      <MemoryRouter>
        <LiveContext.Provider value={openLiveSocket()}>
          <RoleProvider>
            <HistoryPage />
          </RoleProvider>
        </LiveContext.Provider>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "push_swap" });

    // minishell's evaluation got its result.
    act(() =>
      FakeSocket.latest().serverSend({
        event: "evaluation.updated",
        data: { id: 2, status: "confirmed" },
      }),
    );

    expect(screen.queryByText("Loading history…")).toBeNull();
    expect(await screen.findByRole("heading", { name: "minishell" })).toBeTruthy();
    expect(listEvaluationRequests).toHaveBeenCalledTimes(2);
    expect(listEvaluationRequests).toHaveBeenLastCalledWith({
      scope: "mine",
      history: true,
      status: undefined,
      project: undefined,
      page: 1,
    });
  });
});
