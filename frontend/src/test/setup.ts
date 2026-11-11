import { afterEach, expect } from "vitest";

import i18n from "../i18n";

// Tests read the English texts; a test that switches the language does not leak into the next.
afterEach(async () => {
  window.localStorage.removeItem("language");
  await i18n.changeLanguage("en");
});

// Known, harmless console messages a test may still write, as patterns of the message text.
// Every entry needs a comment saying where the message comes from and why it cannot be fixed.
// Empty for now: every message found so far was fixed at its cause.
const allowedConsoleMessages: RegExp[] = [];

// What the code under test wrote with console.error or console.warn since the last check.
let consoleMessages: string[] = [];

// The subject forbids errors and warnings in the browser console. React reports its warnings
// (a list without keys, an update outside act(...)) with console.error, so they would pass
// `npm test` with only a line on stderr (#778). Each call is recorded here and still printed, so
// its stack trace stays visible. Plain wrappers rather than vi.spyOn: the afterEach hooks of the
// test files run before this file's and call vi.clearAllMocks(), resetAllMocks() or
// restoreAllMocks(), which would wipe a spy's calls before they are checked.
for (const level of ["error", "warn"] as const) {
  const original = console[level];

  console[level] = (...args: unknown[]) => {
    consoleMessages.push(`console.${level}: ${args.map(String).join(" ")}`);
    original(...args);
  };
}

// Fails the test that wrote to the console. The list is emptied only here, so a message logged
// late (after its test already finished) fails the next test instead of being lost.
afterEach(() => {
  const unexpected = consoleMessages.filter(
    (message) => !allowedConsoleMessages.some((pattern) => pattern.test(message)),
  );

  consoleMessages = [];
  expect(
    unexpected,
    "The test wrote to the console: fix the cause, or allowlist it in src/test/setup.ts",
  ).toEqual([]);
});
