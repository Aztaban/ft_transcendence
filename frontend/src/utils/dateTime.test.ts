import { describe, expect, it } from "vitest";

import { formatDayHeading, formatDuration, formatStartsIn, formatTimeAgo } from "./dateTime";

describe("formatTimeAgo", () => {
  const now = new Date("2026-10-09T12:00:00Z");

  it("says just now for less than a minute", () => {
    expect(formatTimeAgo("2026-10-09T11:59:30Z", now)).toBe("just now");
  });

  it("uses minutes, hours and days", () => {
    expect(formatTimeAgo("2026-10-09T11:45:00Z", now)).toBe("15 minutes ago");
    expect(formatTimeAgo("2026-10-09T10:00:00Z", now)).toBe("2 hours ago");
    expect(formatTimeAgo("2026-10-06T12:00:00Z", now)).toBe("3 days ago");
  });

  it("says yesterday for one day", () => {
    expect(formatTimeAgo("2026-10-08T12:00:00Z", now)).toBe("yesterday");
  });
});

describe("formatDayHeading", () => {
  const now = new Date(2026, 9, 13, 10, 0);

  it("names today and tomorrow", () => {
    expect(formatDayHeading(new Date(2026, 9, 13, 18, 0).toISOString(), now)).toBe(
      "Today · Tuesday 13 October",
    );
    expect(formatDayHeading(new Date(2026, 9, 14, 9, 0).toISOString(), now)).toBe(
      "Tomorrow · Wednesday 14 October",
    );
  });

  it("shows only the date for later days", () => {
    expect(formatDayHeading(new Date(2026, 9, 20, 9, 0).toISOString(), now)).toBe(
      "Tuesday 20 October",
    );
  });
});

describe("formatStartsIn", () => {
  const now = new Date("2026-10-13T10:00:00Z");

  it("uses the two largest units", () => {
    expect(formatStartsIn("2026-10-15T14:30:00Z", now)).toBe("2 days 4 hours");
    expect(formatStartsIn("2026-10-13T13:20:00Z", now)).toBe("3 hours 20 minutes");
    expect(formatStartsIn("2026-10-14T10:00:00Z", now)).toBe("1 day");
    expect(formatStartsIn("2026-10-13T10:45:00Z", now)).toBe("45 minutes");
  });

  it("says now once the start has passed", () => {
    expect(formatStartsIn("2026-10-13T09:59:00Z", now)).toBe("now");
  });
});

describe("formatDuration", () => {
  it("gives the slot length in minutes", () => {
    expect(formatDuration("2026-10-13T09:00:00Z", "2026-10-13T09:45:00Z")).toBe("45 min");
  });
});
