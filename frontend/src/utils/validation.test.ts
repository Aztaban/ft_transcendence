import { describe, expect, it } from "vitest";

import { EMAIL_PATTERN } from "./validation";

describe("EMAIL_PATTERN", () => {
  it.each([
    "student@42prague.com",
    "first.last+tag@mail.example.cz",
    "o'neil@sub-domain.example.org",
  ])("accepts %s", (email) => {
    expect(EMAIL_PATTERN.test(email)).toBe(true);
  });

  it.each([
    "abs",
    "a@b",
    "a@b.c",
    "a b@example.com",
    "a@-example.com",
    "a@example-.com",
    "a@example..com",
    "a@example.c0m",
    "ä@example.com",
  ])("rejects %s", (email) => {
    expect(EMAIL_PATTERN.test(email)).toBe(false);
  });
});
