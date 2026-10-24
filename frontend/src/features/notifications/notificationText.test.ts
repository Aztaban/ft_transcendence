import { afterEach, describe, expect, test, vi } from "vitest";

import i18n from "../../i18n";
import type { Notification, NotificationType } from "../../types/notification";
import { formatSlot } from "../../utils/dateTime";
import { notificationText } from "./notificationText";

// The local time depends on the machine's time zone; formatSlot has its own tests.
vi.mock("../../utils/dateTime", () => ({ formatSlot: vi.fn(() => "Sun, 25 Oct, 15:00–15:45") }));

const libft = { id: 4, slug: "libft", name: "Libft" };
const bob = { id: 2, display_name: "Bob" };

function notification(type: NotificationType, payload: Record<string, unknown>): Notification {
  return {
    id: 12,
    type,
    payload,
    target_url: "",
    read_at: null,
    created_at: "2026-10-24T09:00:00Z",
  };
}

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("notificationText", () => {
  test("builds the sentence from the type and the payload", () => {
    expect(
      [
        notification("evaluation.created", { request_id: 17, project: libft }),
        notification("evaluation.declined", { request_id: 17, project: libft, student: bob }),
        notification("evaluation.released", { request_id: 17, project: libft, tutor: bob }),
        notification("evaluation.cancelled", {
          request_id: 17,
          project: libft,
          cancelled_by: bob,
        }),
        notification("eligibility.requested", { request_id: 5, requester: bob, projects: [libft] }),
        notification("eligibility.revoked", { project: libft }),
        notification("sc_message.created", { message_id: 3 }),
        notification("resource.created", {
          file_id: 8,
          title: "Libft tips",
          project: libft,
          owner: bob,
        }),
        notification("resource.updated", { file_id: 8, title: "Libft tips" }),
        notification("resource.deleted", { title: "Libft tips" }),
      ].map(notificationText),
    ).toEqual([
      "New evaluation request for Libft",
      "Bob declined your slot for Libft",
      "Bob released your evaluation request for Libft",
      "Bob cancelled the evaluation of Libft",
      "Bob asked to evaluate new projects",
      "You can no longer evaluate Libft",
      "New anonymous message for the Student Council",
      'Bob shared "Libft tips"',
      'Your resource "Libft tips" was edited',
      'Your resource "Libft tips" was deleted',
    ]);
  });

  test("adds the time slot in local time", () => {
    const slot = { starts_at: "2026-10-25T14:00:00Z", ends_at: "2026-10-25T14:45:00Z" };

    expect(
      [
        notification("evaluation.slot_picked", {
          request_id: 17,
          project: libft,
          tutor: bob,
          ...slot,
        }),
        notification("evaluation.confirmed", {
          request_id: 17,
          project: libft,
          student: bob,
          ...slot,
        }),
      ].map(notificationText),
    ).toEqual([
      "Bob picked a slot for Libft: Sun, 25 Oct, 15:00–15:45. Please confirm it",
      "Bob confirmed the evaluation of Libft: Sun, 25 Oct, 15:00–15:45",
    ]);
    expect(formatSlot).toHaveBeenCalledWith("2026-10-25T14:00:00Z", "2026-10-25T14:45:00Z");
  });

  test("picks the sentence for the status value", () => {
    expect(
      [
        notification("evaluation.expired", {
          request_id: 17,
          project: libft,
          previous_status: "pending",
        }),
        notification("evaluation.expired", {
          request_id: 17,
          project: libft,
          previous_status: "awaiting_confirmation",
        }),
        notification("evaluation.result_recorded", {
          request_id: 17,
          project: libft,
          result: "passed",
        }),
        notification("evaluation.result_recorded", {
          request_id: 17,
          project: libft,
          result: "failed",
        }),
        notification("eligibility.decided", {
          request_id: 5,
          decision: "approved",
          review_note: "",
        }),
        notification("eligibility.decided", {
          request_id: 5,
          decision: "declined",
          review_note: "",
        }),
      ].map(notificationText),
    ).toEqual([
      "Your evaluation request for Libft expired: nobody picked it",
      "The evaluation of Libft expired before the slot was confirmed",
      "Result for Libft: passed",
      "Result for Libft: failed",
      "Your eligibility request was approved",
      "Your eligibility request was declined",
    ]);
  });

  test("shows the role's label, never its raw name", () => {
    expect(
      [
        notification("role.changed", { role: "tutor", action: "assigned" }),
        notification("role.changed", { role: "sc_member", action: "revoked" }),
        notification("account.updated", { fields: ["display_name"] }),
      ].map(notificationText),
    ).toEqual([
      "You now have the role Hitchhiker",
      "You no longer have the role Student Council",
      "An administrator updated your account",
    ]);
  });

  test("uses the current language", async () => {
    await i18n.changeLanguage("cs");

    expect(
      notificationText(
        notification("evaluation.cancelled", { request_id: 17, project: libft, cancelled_by: bob }),
      ),
    ).toBe("Evaluace projektu Libft byla zrušena (Bob)");
    expect(
      notificationText(notification("role.changed", { role: "admin", action: "assigned" })),
    ).toBe("Máte novou roli: Administrátor");
  });
});
