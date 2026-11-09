import axe from "axe-core";

// Accessibility check for tests (#359): runs axe-core, the engine behind the browser's axe and
// Lighthouse audits, with the WCAG 2.1 A and AA rules on the rendered page. Returns one line per
// problem, "rule-id: element", so a failing test says what to fix.
//
// What it cannot check here, so it needs the browser or another test:
// - Colour contrast: jsdom computes no colours. A token contrast test is planned with the design
//   tokens (#731); until then contrast is checked by hand (#322).
// - `document-title`, `html-has-lang` and `bypass`: the scan starts at `body`, below the document.
// - `link-in-text-block` and `scrollable-region-focusable`: they need layout, which jsdom has not.
// - Experimental rules, which axe leaves out of the WCAG tags.
export async function accessibilityViolations() {
  const results = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });

  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`),
  );
}
