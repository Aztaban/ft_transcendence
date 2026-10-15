import { describe, expect, it } from "vitest";

import { isStartAllowed, slotEnd, slotStart, upcomingDays } from "./slotRules";

// Local time, like the browser.
const now = new Date(2026, 9, 12, 10, 0);

describe("slotRules", () => {
  it("lists 14 days starting today at midnight", () => {
    const days = upcomingDays(now);

    expect(days).toHaveLength(14);
    expect(days[0]).toEqual(new Date(2026, 9, 12));
    expect(days[13]).toEqual(new Date(2026, 9, 25));
  });

  it("builds the start and end of a slot", () => {
    const start = slotStart(new Date(2026, 9, 13), 9, 15);

    expect(start).toEqual(new Date(2026, 9, 13, 9, 15));
    expect(slotEnd(start, 45)).toEqual(new Date(2026, 9, 13, 10, 0));
  });

  it("needs at least 30 minutes of notice", () => {
    expect(isStartAllowed(new Date(2026, 9, 12, 10, 15), now)).toBe(false);
    expect(isStartAllowed(new Date(2026, 9, 12, 10, 30), now)).toBe(true);
  });

  // Real elapsed time, not calendar days: Prague switches to winter time on 25 Oct 2026.
  it("allows at most 14 days ahead", () => {
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;

    expect(isStartAllowed(new Date(now.getTime() + fourteenDays), now)).toBe(true);
    expect(isStartAllowed(new Date(now.getTime() + fourteenDays + 15 * 60 * 1000), now)).toBe(
      false,
    );
  });
});
