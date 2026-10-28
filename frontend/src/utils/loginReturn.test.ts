import { afterEach, describe, expect, test, vi } from "vitest";

import { isAppPath, rememberReturnPath, takeReturnPath } from "./loginReturn";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("isAppPath", () => {
  test("accepts only paths inside the app", () => {
    expect(isAppPath("/history?status=cancelled")).toBe(true);
    expect(isAppPath("//other.site/page")).toBe(false);
    expect(isAppPath("/\\other.site")).toBe(false);
    expect(isAppPath("https://other.site")).toBe(false);
    expect(isAppPath(null)).toBe(false);
  });
});

describe("rememberReturnPath and takeReturnPath", () => {
  test("keep a page once", () => {
    rememberReturnPath("/pending");

    expect(takeReturnPath()).toBe("/pending");
    expect(takeReturnPath()).toBeNull();
  });

  test("do not keep Home or a path outside the app", () => {
    rememberReturnPath("/");
    expect(takeReturnPath()).toBeNull();

    sessionStorage.setItem("login-return-to", "//other.site");
    expect(takeReturnPath()).toBeNull();
  });

  test("work without storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => rememberReturnPath("/pending")).not.toThrow();
    expect(takeReturnPath()).toBeNull();
  });
});
