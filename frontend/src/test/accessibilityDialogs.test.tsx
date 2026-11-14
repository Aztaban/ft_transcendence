import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import AccountActionDialog from "../features/admin/AccountActionDialog";
import MarkedReadDialog from "../features/council/MarkedReadDialog";
import MessageSentDialog from "../features/council/MessageSentDialog";
import ModerationDialog from "../features/council/ModerationDialog";
import ReviewDialog from "../features/headTutor/ReviewDialog";
import EligibilitySentDialog from "../features/hitchhiker/EligibilitySentDialog";
import SuccessDialog from "../features/hitchhiker/SuccessDialog";
import WelcomeHitchhikerDialog from "../features/hitchhiker/WelcomeHitchhikerDialog";
import CancelDialog from "../features/pending/CancelDialog";
import PreviewDialog from "../features/pending/PreviewDialog";
import RequestSuccessDialog from "../features/requests/RequestSuccessDialog";
import CancelRequestDialog from "../features/student/CancelRequestDialog";
import type { EligibilityRequest } from "../types/eligibility";
import type { EvaluationRequest } from "../types/evaluation";
import { accessibilityViolations } from "./axe";

// Accessibility scan of every popup (#784, follow-up to #359): the page scan in
// accessibility.test.tsx checks each page as it first opens, so no popup is ever open there. Each
// one is rendered open here, also with its error, and checked with the same axe-core WCAG 2.1 A
// and AA rules. Focus, Tab and Escape are tested in Dialog.test.tsx and useDialog.test.tsx.

vi.mock("../api/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/projects")>()),
  listProjects: vi.fn(async () => [project, { id: 5, slug: "minishell", name: "minishell" }]),
}));

afterEach(cleanup);

const project = { id: 4, slug: "push_swap", name: "push_swap" };

function evaluation(extra: Partial<EvaluationRequest> = {}): EvaluationRequest {
  return {
    id: 7,
    student: { id: 1, display_name: "Diana", avatar_url: null },
    project,
    note: "",
    status: "confirmed",
    picked_by: { id: 2, display_name: "Lenka", avatar_url: null },
    starts_at: "2030-01-10T09:00:00Z",
    ends_at: "2030-01-10T09:45:00Z",
    cancelled_by: null,
    cancelled_at: null,
    expired_at: null,
    result: null,
    feedback: "",
    completed_at: null,
    is_history: false,
    created_at: "2026-10-28T09:00:00Z",
    updated_at: "2026-10-28T09:00:00Z",
    ...extra,
  };
}

const eligibilityRequest: EligibilityRequest = {
  id: 9,
  requester: { id: 2, display_name: "Lenka", avatar_url: null },
  projects: [project],
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  review_note: "",
  created_at: "2026-10-29T09:00:00Z",
};

const noop = () => {};

// Rendered inside a router, like in the app; the popup must be open and named.
async function scan(popup: ReactElement) {
  render(<MemoryRouter>{popup}</MemoryRouter>);
  expect(screen.getByRole("dialog")).toBeTruthy();

  return accessibilityViolations();
}

const popups: [string, () => ReactElement][] = [
  [
    "the student's cancel request",
    () => (
      <CancelRequestDialog
        request={evaluation({ status: "pending", picked_by: null, starts_at: null, ends_at: null })}
        isSubmitting={false}
        error=""
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "the student's cancel request, with its error",
    () => (
      <CancelRequestDialog
        request={evaluation({ status: "pending", picked_by: null, starts_at: null, ends_at: null })}
        isSubmitting={false}
        error="Could not cancel the request."
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  ["the request success popup", () => <RequestSuccessDialog onClose={noop} />],
  [
    "the evaluation preview",
    () => (
      <PreviewDialog
        evaluation={evaluation()}
        otherPerson={{ label: "Hitchhiker", name: "Lenka" }}
        statusLabel="Scheduled"
        onClose={noop}
      />
    ),
  ],
  [
    "cancel an evaluation, as the student",
    () => (
      <CancelDialog
        evaluation={evaluation()}
        viewer="student"
        isDone={false}
        isSubmitting={false}
        error=""
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "cancel an evaluation, as the Hitchhiker, with its error",
    () => (
      <CancelDialog
        evaluation={evaluation()}
        viewer="hitchhiker"
        isDone={false}
        isSubmitting={false}
        error="Could not cancel the evaluation."
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "an evaluation cancelled",
    () => (
      <CancelDialog
        evaluation={evaluation({ status: "cancelled" })}
        viewer="student"
        isDone
        isSubmitting={false}
        error=""
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "the slot sent popup",
    () => <SuccessDialog onClose={noop}>Slot sent to the student!</SuccessDialog>,
  ],
  ["the eligibility request sent popup", () => <EligibilitySentDialog onClose={noop} />],
  [
    "the Head Tutor's approve",
    () => (
      <ReviewDialog
        request={eligibilityRequest}
        decision="approved"
        isSubmitting={false}
        error=""
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "the Head Tutor's decline, with its error",
    () => (
      <ReviewDialog
        request={eligibilityRequest}
        decision="declined"
        isSubmitting={false}
        error="Could not save the review."
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  ["the message sent popup", () => <MessageSentDialog onClose={noop} />],
  ["the marked as read popup", () => <MarkedReadDialog onClose={noop} />],
  [
    "reveal the sender",
    () => (
      <ModerationDialog
        action="reveal"
        messageId={3}
        isSubmitting={false}
        error=""
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "delete a message, with its error",
    () => (
      <ModerationDialog
        action="delete"
        messageId={3}
        isSubmitting={false}
        error="Could not delete the message."
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "suspend an account",
    () => (
      <AccountActionDialog
        action="suspend"
        name="Lenka"
        isSubmitting={false}
        error=""
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "reactivate an account",
    () => (
      <AccountActionDialog
        action="reactivate"
        name="Lenka"
        isSubmitting={false}
        error=""
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
  [
    "delete an account, with its error",
    () => (
      <AccountActionDialog
        action="delete"
        name="Lenka"
        isSubmitting={false}
        error="Could not delete the account."
        onConfirm={noop}
        onClose={noop}
      />
    ),
  ],
];

describe("accessibility of every popup (axe-core, WCAG 2.1 AA)", () => {
  it.each(popups)("%s", async (_name, popup) => {
    expect(await scan(popup())).toEqual([]);
  });

  it("the welcome popup with its project list", async () => {
    render(
      <MemoryRouter>
        <WelcomeHitchhikerDialog onClose={noop} />
      </MemoryRouter>,
    );
    await screen.findByText("minishell");

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(await accessibilityViolations()).toEqual([]);
  });
});
