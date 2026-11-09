# Accessibility

How 42 Evals meets WCAG 2.1 AA, and how it was tested (#12, #323).

Subject module: *Major: complete accessibility compliance (WCAG 2.1 AA) with screen reader support, keyboard navigation, and assistive technologies.*

## What the application does

| Area | What is in place | WCAG | Issue |
| --- | --- | --- | --- |
| Keyboard | Every control is a real button, link or form field. A "Skip to content" link is the first Tab stop. The role switcher works with ↑ ↓, Enter and Escape; tabs work with ← → Home End. | 2.1.1, 2.4.1 | #318 |
| Focus | A visible focus ring on every control. Popups take the focus, keep Tab inside, close on Escape and give the focus back to the button that opened them. | 2.4.3, 2.4.7 | #320 |
| Page structure | Every page has its own browser tab title ("History · 42 Evals") and one `h1`. Landmarks: one `header`, `nav`, `main` and `footer`; info boxes and side panels are not extra landmarks. | 2.4.2, 1.3.1 | #321, #319 |
| Screen readers | Search results, loading states and save confirmations are announced through `aria-live` status lines; errors use `role="alert"`. Loading areas are `aria-busy`. Icons are decorative (`alt=""`) unless they are the only label. | 4.1.3, 1.1.1 | #321 |
| Language | `<html lang>` follows the language switcher (en, cs, es), so screen readers pronounce each language correctly. | 3.1.1 | #11 |
| Colour and contrast | Text is at least 4.5:1, focus rings and meaningful icons at least 3:1. Dark text on the 42 teal (white on teal is only 2.4:1). The palette tokens are tested for contrast. Status is never shown by colour alone. | 1.4.3, 1.4.11, 1.4.1 | #322, #731 |
| Motion | Animations stop with `prefers-reduced-motion`, and the moving Home banner has a pause button. | 2.2.2, 2.3.3 | #713 |
| Forms | Every field has a label; errors appear next to their field and are linked to it. | 3.3.1, 3.3.2 | — |

## How it is tested

### Automated, on every `npm test` (CI)

- **axe-core on every page** (`frontend/src/test/accessibility.test.tsx`, #359): 23 logged-in routes in their workspaces plus Login and Register, each checked against the WCAG 2.1 A and AA rules. A route only counts once its own heading is shown, no loading placeholder or error is left and the user's roles are loaded, so an error or Unauthorized page cannot pass in its place. Result: **0 violations**.
- **Palette contrast** (`frontend/src/styles/tokens.test.ts`, #731): every text/surface token pair is at least 4.5:1.
- **Clean console** (`frontend/src/test/setup.ts`, #778, PR #790): a test fails if it writes a React warning or error to the console.
- **Component tests**: the reusable components test their own roles and keyboard behaviour (`frontend/src/components/ui/*.test.tsx`, design system #730).

What jsdom cannot check (colour contrast as rendered, layout-based rules, the document title) is covered by the manual tests below.

### Manual, in a real browser (2026-11-09)

Chrome on Ubuntu, logged in with every role, all three languages.

| Test | Pages | Result |
| --- | --- | --- |
| Lighthouse accessibility audit (includes rendered contrast) | Home, Request, History, Hitchhikers, Council inbox, Eligibility review, Login, Design system | No failed audits |
| Keyboard only | Home, Request (whole flow), popups, role switcher, eligibility tabs | Skip link works, focus always visible and in order, popups trap and return focus, arrow keys work |
| Screen reader: Orca | Home, Hitchhikers search, a popup, language switch to Czech | Page titles, headings (H) and landmarks (D) read correctly; search results and popup titles announced; Czech pronunciation after the switch |

## How to check it yourself

1. `cd frontend && npm test`: runs the axe scan, the contrast and the console tests.
2. Chrome DevTools → Lighthouse → Accessibility, on any page.
3. Tab from the address bar: the first stop is "Skip to content".
4. Linux: Orca (Super + Alt + S). macOS: VoiceOver (Cmd + F5). Windows: NVDA.

## Known limits

- The axe scan opens each page as it first loads; dialogs, menus and some states are covered by their own tests and the manual checks, and a scan of those states is planned (#784).
- The external links in the sidebar (42 Intra, Notion, Slack) are named links; their logos are brand marks, not icons of the design system.
