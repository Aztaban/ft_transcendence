import { describe, expect, it } from "vitest";

import { EMAIL_PATTERN, validateRegistration } from "./validation";

// The Register form's checks in the browser (api-plan §10.1); the backend checks them again.
describe("validateRegistration", () => {
  const valid = { display_name: "dkolarov", email: "diana@example.com", password: "Evaluat10ns" };

  it("accepts every field at its limit", () => {
    expect(
      validateRegistration({
        display_name: "a".repeat(64),
        // 242 + 12 = 254 characters.
        email: `${"a".repeat(242)}@example.com`,
        password: "abcdefgh",
      }),
    ).toEqual({});
  });

  it("asks for every field", () => {
    expect(validateRegistration({ display_name: "", email: "", password: "" })).toEqual({
      display_name: "Display name is required.",
      email: "Email is required.",
      password: "Password is required.",
    });
  });

  it.each([
    [
      "a display name over 64 characters",
      { display_name: "a".repeat(65) },
      "display_name",
      "Display name must be 64 characters or fewer.",
    ],
    [
      "an email over 254 characters",
      { email: `${"a".repeat(243)}@example.com` },
      "email",
      "Email must be 254 characters or fewer.",
    ],
    [
      "an email without a top-level domain",
      { email: "diana@example" },
      "email",
      "Enter a valid email address.",
    ],
    [
      "a password under 8 characters",
      { password: "abcdefg" },
      "password",
      "Password must contain at least 8 characters.",
    ],
    [
      "a password of only digits",
      { password: "12345678" },
      "password",
      "Password cannot contain only numbers.",
    ],
  ])("rejects %s", (_case, change, field, message) => {
    expect(validateRegistration({ ...valid, ...change })).toEqual({ [field]: message });
  });

  it("names the length before the format of a too long email", () => {
    expect(validateRegistration({ ...valid, email: "a".repeat(255) })).toEqual({
      email: "Email must be 254 characters or fewer.",
    });
  });
});

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
