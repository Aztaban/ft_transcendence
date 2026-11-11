import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listEvaluationExceptions } from "../api/admin";
import { makeRequest } from "../features/student/testUtils";
import { RoleProvider } from "../store/RoleContext";
import type { EvaluationException, EvaluationProblem } from "../types/evaluation";
import EvaluationExceptionsPage from "./EvaluationExceptionsPage";

vi.mock("../api/admin", () => ({ listEvaluationExceptions: vi.fn() }));

// The user's real roles from /users/me/; each test may change them before rendering.
const currentUser = vi.hoisted(() => ({ roles: ["student", "head_tutor"], isLoaded: true }));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, refresh: () => {} }),
}));

function exception(
  id: number,
  projectName: string,
  status: EvaluationException["status"],
  problem: EvaluationProblem,
): EvaluationException {
  return { ...makeRequest(id, projectName, status), problem };
}

function page(results: EvaluationException[], count = results.length, next: string | null = null) {
  return { count, next, previous: null, results };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <EvaluationExceptionsPage />
      </RoleProvider>
    </MemoryRouter>,
  );
}

// The text of each cell, row by row (the header row left out).
function tableRows() {
  return within(screen.getByRole("table", { name: "Evaluation exceptions" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
}

beforeEach(() => {
  vi.mocked(listEvaluationExceptions).mockResolvedValue(page([]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
  currentUser.roles = ["student", "head_tutor"];
  currentUser.isLoaded = true;
});

describe("EvaluationExceptionsPage", () => {
  it("lists each request with its problem, what to do and a link to it", async () => {
    vi.mocked(listEvaluationExceptions).mockResolvedValue(
      page([
        exception(7, "libft", "confirmed", "result_missing"),
        exception(5, "push_swap", "pending", "participant_inactive"),
      ]),
    );

    renderPage();
    await screen.findByRole("table");

    const [first, second] = tableRows();

    expect(first.slice(0, 4)).toEqual([
      "Result missingThe evaluation is over but has no result. Enter it in the Django admin.",
      "libftConfirmed",
      "Student",
      "Hitchhiker",
    ]);
    expect(second).toEqual([
      "Participant suspendedThe student or the Hitchhiker is suspended. Release or cancel the request, or reactivate the account.",
      "push_swapIn the queue",
      "Student",
      "—",
      "No slot yet",
    ]);
    expect(screen.getByRole("link", { name: "libft" }).getAttribute("href")).toBe("/evaluations/7");
    expect(document.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-12T15:00:00Z");
    expect(listEvaluationExceptions).toHaveBeenCalledWith(1);
    expect(document.title).toBe("Evaluation exceptions · 42 Evals");
  });

  it("labels a Hitchhiker who lost eligibility", async () => {
    vi.mocked(listEvaluationExceptions).mockResolvedValue(
      page([exception(3, "minitalk", "awaiting_confirmation", "tutor_lost_eligibility")]),
    );

    renderPage();

    expect(await screen.findByText("Hitchhiker not eligible")).toBeTruthy();
    expect(screen.getByText("Waiting for the student")).toBeTruthy();
  });

  it("pages through the exceptions", async () => {
    vi.mocked(listEvaluationExceptions)
      .mockResolvedValueOnce(
        page([exception(1, "libft", "confirmed", "result_missing")], 21, "/?page=2"),
      )
      .mockResolvedValueOnce(page([exception(2, "cub3d", "confirmed", "result_missing")], 21));

    renderPage();

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(await screen.findByRole("link", { name: "cub3d" })).toBeTruthy();
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(vi.mocked(listEvaluationExceptions).mock.calls).toEqual([[1], [2]]);
  });

  it("says so when nothing needs a decision", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Nothing needs a decision" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an error when the exceptions cannot be loaded", async () => {
    vi.mocked(listEvaluationExceptions).mockRejectedValue(new Error("network"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We couldn't load the exceptions. Please try again later.",
    );
  });

  it("is open to an Admin who is not a Head Tutor", async () => {
    currentUser.roles = ["student", "admin"];

    renderPage();

    expect(await screen.findByText("Nothing needs a decision")).toBeTruthy();
    expect(listEvaluationExceptions).toHaveBeenCalledTimes(1);
  });

  it("shows the unauthorized page to a Hitchhiker who is not a Head Tutor, without asking", () => {
    currentUser.roles = ["student", "tutor"];

    renderPage();

    expect(screen.getByText("This page is not available for your current role.")).toBeTruthy();
    expect(listEvaluationExceptions).not.toHaveBeenCalled();
  });

  it("waits for the roles before asking", () => {
    currentUser.roles = [];
    currentUser.isLoaded = false;

    renderPage();

    expect(screen.getByText("Loading the exceptions…")).toBeTruthy();
    expect(listEvaluationExceptions).not.toHaveBeenCalled();
  });
});
