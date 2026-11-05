import axe from "axe-core";

// Accessibility check for tests (#359): runs axe-core, the engine behind the browser's axe and
// Lighthouse audits, with the WCAG 2.1 A and AA rules on what a test rendered. Returns one line
// per problem, "rule-id: element", so a failing test says what to fix. Colour contrast is left
// out because jsdom cannot compute colours; tokens.test.ts checks the palette instead.
export async function accessibilityViolations(container: Element = document.body) {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });

  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`),
  );
}
