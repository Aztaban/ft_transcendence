import { describe, expect, it } from "vitest";

import { ApiError } from "../../api/client";
import type { EvaluationRequest } from "../../types/evaluation";
import { canCancel, cancelErrorMessage } from "./cancelRequest";
import { makeRequest } from "./testUtils";

const now = new Date("2026-10-19T10:00:00Z");

function withStart(request: EvaluationRequest, startsAt: string): EvaluationRequest {
  return { ...request, starts_at: startsAt, ends_at: startsAt };
}

describe("canCancel", () => {
  it("allows pending, awaiting and confirmed requests until their slot starts", () => {
    expect(canCancel(makeRequest(1, "push_swap", "pending"), now)).toBe(true);
    expect(
      canCancel(
        withStart(makeRequest(2, "push_swap", "awaiting_confirmation"), "2026-10-20T10:00:00Z"),
        now,
      ),
    ).toBe(true);
    expect(
      canCancel(withStart(makeRequest(3, "push_swap", "confirmed"), "2026-10-20T10:00:00Z"), now),
    ).toBe(true);
  });

  it("refuses once the slot has started, and for ended requests", () => {
    expect(
      canCancel(withStart(makeRequest(3, "push_swap", "confirmed"), "2026-10-19T09:00:00Z"), now),
    ).toBe(false);
    expect(
      canCancel(
        withStart(makeRequest(2, "push_swap", "awaiting_confirmation"), "2026-10-19T10:00:00Z"),
        now,
      ),
    ).toBe(false);
    expect(canCancel(makeRequest(4, "push_swap", "cancelled"), now)).toBe(false);
    expect(canCancel(makeRequest(5, "push_swap", "expired"), now)).toBe(false);
  });
});

describe("cancelErrorMessage", () => {
  it("explains the errors from the contract", () => {
    expect(cancelErrorMessage(new ApiError(409, "Conflict", "evaluation_already_started"))).toBe(
      "This evaluation has already started, so it can't be cancelled.",
    );
    expect(cancelErrorMessage(new ApiError(409, "Conflict", "invalid_state_transition"))).toBe(
      "This request can no longer be cancelled.",
    );
    expect(cancelErrorMessage(new ApiError(404, "Not found.", "not_found"))).toBe(
      "This request no longer exists.",
    );
    expect(cancelErrorMessage(new Error("network"))).toBe(
      "Could not cancel the request. Please try again.",
    );
  });
});
