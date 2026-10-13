import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { createEvaluationRequest } from "../api/evaluationRequests";
import { listProjects } from "../api/projects";
import CreateRequestPage from "./CreateRequestPage";

vi.mock("../api/projects", () => ({ listProjects: vi.fn() }));
vi.mock("../api/evaluationRequests", () => ({ createEvaluationRequest: vi.fn() }));

const projects = [
  { id: 1, slug: "born2beroot", name: "born2beroot" },
  { id: 2, slug: "push_swap", name: "push_swap" },
];

beforeEach(() => {
  vi.mocked(listProjects).mockResolvedValue(projects);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/requests"]}>
      <Routes>
        <Route path="/requests" element={<CreateRequestPage />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function chooseProject(name: string) {
  fireEvent.click(await screen.findByRole("radio", { name }));
}

function getButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("CreateRequestPage", () => {
  it("starts on step 1 with the notice and Next disabled", async () => {
    renderPage();

    expect(screen.getByText("Step 1 / 2 · Select Project")).toBeTruthy();
    expect(screen.getByText(/the Hitchhiker evaluation is the last evaluation/)).toBeTruthy();
    expect(getButton("Next").disabled).toBe(true);

    await chooseProject("push_swap");

    expect(getButton("Next").disabled).toBe(false);
  });

  it("explains how a request works next to the form", async () => {
    renderPage();
    await screen.findByRole("radio", { name: "push_swap" });

    const steps = screen.getAllByRole("listitem").map((item) => item.textContent);

    expect(screen.getByRole("heading", { name: "How it works" })).toBeTruthy();
    expect(steps).toEqual([
      "Choose a projectPick the project and add a note if you like.",
      "A Hitchhiker proposes a timeAn eligible Hitchhiker picks your request.",
      "You confirmAccept the time, or decline it to wait for another one.",
    ]);
  });

  it("shows the chosen project on the confirmation step and can go back", async () => {
    renderPage();
    await chooseProject("push_swap");

    fireEvent.click(getButton("Next"));

    expect(screen.getByRole("heading", { name: "Confirmation" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "push_swap" })).toBeTruthy();

    fireEvent.click(getButton("Edit"));

    expect(screen.getByText("Step 1 / 2 · Select Project")).toBeTruthy();
  });

  it("sends the request and shows the success popup, which closes on a click outside", async () => {
    vi.mocked(createEvaluationRequest).mockResolvedValue();
    renderPage();
    await chooseProject("push_swap");
    fireEvent.click(getButton("Next"));

    fireEvent.click(getButton("Submit"));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(createEvaluationRequest).toHaveBeenCalledWith({ project_id: 2 });

    fireEvent.click(screen.getByTestId("request-dialog-backdrop"));

    expect(screen.getByText("Home page")).toBeTruthy();
  });

  it("sends the optional note and shows it on the confirmation step", async () => {
    vi.mocked(createEvaluationRequest).mockResolvedValue();
    renderPage();
    await chooseProject("push_swap");

    fireEvent.change(screen.getByLabelText(/Note for the Hitchhiker/), {
      target: { value: "  I'm free after 18:00 on Friday.  " },
    });

    expect(screen.getByText("35 / 500")).toBeTruthy();

    fireEvent.click(getButton("Next"));

    expect(screen.getByText("I'm free after 18:00 on Friday.")).toBeTruthy();

    fireEvent.click(getButton("Submit"));

    await screen.findByRole("dialog");
    expect(createEvaluationRequest).toHaveBeenCalledWith({
      project_id: 2,
      note: "I'm free after 18:00 on Friday.",
    });
  });

  it("explains when the student already has an active request for the project", async () => {
    vi.mocked(createEvaluationRequest).mockRejectedValue(
      new ApiError(409, "Conflict", "active_request_exists"),
    );
    renderPage();
    await chooseProject("push_swap");
    fireEvent.click(getButton("Next"));

    fireEvent.click(getButton("Submit"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You already have an active request for this project.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
