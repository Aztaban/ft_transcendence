import { describe, expect, it } from "vitest";

import { formatTimeAgo } from "./dateTime";

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
