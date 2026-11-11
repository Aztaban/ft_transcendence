import { describe, expect, it } from "vitest";

import tokensCss from "./tokens.css?raw";

// The colour tokens of tokens.css, e.g. "--color-danger-text" → "#b42318".
const colors = Object.fromEntries(
  [...tokensCss.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, value]) => [
    name,
    value,
  ]),
);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;

    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.1 contrast ratio of two colours.
function contrast(first: string, second: string) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
}

describe("palette tokens", () => {
  it.each([
    ["--color-text-secondary", "--color-white"],
    ["--color-text-secondary", "--color-background"],
    ["--color-accent-text", "--color-white"],
    ["--color-accent-strong-text", "--color-accent-surface"],
    ["--color-on-accent", "--color-accent"],
    ["--color-on-accent", "--color-accent-hover"],
    ["--color-accent-text", "--color-accent-surface"],
    ["--color-neutral-700", "--color-white"],
    ["--color-danger-text", "--color-danger-surface"],
    ["--color-success-text", "--color-success-surface"],
    ["--color-warning-text", "--color-warning-surface"],
    ["--color-info-text", "--color-info-surface"],
    ["--color-violet-text", "--color-violet-surface"],
  ])("keeps %s readable on %s (WCAG AA, 4.5:1)", (text, background) => {
    expect(colors[text]).toBeDefined();
    expect(colors[background]).toBeDefined();
    expect(contrast(colors[text], colors[background])).toBeGreaterThanOrEqual(4.5);
  });
});
