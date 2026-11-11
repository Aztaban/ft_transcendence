# Design system

The colours, type, icons and reusable components that 42 Evals is built from (#730). Logged in, the page `/design-system` shows all of them; the footer links it.

Subject module: *Minor: custom-made design system with reusable components, including a proper color palette, typography, and icons (minimum: 10 reusable components).*

## Where things are

| What | Where |
| --- | --- |
| Tokens (colours, type, spacing, radius, shadows) | `frontend/src/styles/tokens.css` |
| Contrast test of the palette | `frontend/src/styles/tokens.test.ts` |
| Components | `frontend/src/components/ui/` (one file and one test each, exported from `index.ts`) |
| Their default look | `frontend/src/styles/ui.css` |
| Showcase page | `frontend/src/pages/DesignSystemPage.tsx`, route `/design-system` |

## Colour palette

Every family has the same shades, so a page picks by role, not by hex value:

| Shade | Use | Rule |
| --- | --- | --- |
| strong (`--color-success`) | fills, lines, icons | not for text on white unless it reaches 4.5:1 |
| text (`--color-success-text`) | text and icons that carry meaning | 4.5:1 or more on white and on its own surface (WCAG AA) |
| surface (`--color-success-surface`) | light backgrounds of notices, pills, cards | text on it uses the family's text shade |
| border (`--color-danger-border`, where needed) | outlines of light boxes | decoration |

Families: neutral, accent (the 42 teal), success, warning, danger, info and violet.

The accent has a few special tokens:

- `--color-accent` is the teal surface. Text on it is `--color-on-accent` (dark), because white on teal is only 2.4:1.
- `--color-accent-hover` is the hover shade of teal buttons; dark text stays at 5.1:1.
- `--color-accent-text` is teal for text and focus rings on light surfaces (5.5:1).
- `--color-accent-dark` is for decoration only (gradients, underlines), never for text.

`tokens.test.ts` checks every text/surface pair. A new pair means a new line in that test.

## Typography

Sizes are in `rem`, so text follows the browser's font size setting: `--font-size-2xs` (0.75rem) up to `--font-size-4xl` (2rem). Weights: `--font-weight-regular`, `-medium`, `-semibold`, `-bold`. Line heights: `--line-height-tight`, `-snug`, `-normal`.

## Icons

`<Icon name="bell" />` draws one of the Figma line icons (`ICON_NAMES` lists them). It is decoration by default (`alt=""`, `aria-hidden`). Give it a `label` only when the icon is the only thing saying what something is. The 42, Notion and Slack logos are brand marks, not icons.

## Components

| Component | What it is | Accessibility built in |
| --- | --- | --- |
| `Button` | primary, secondary, ghost | `type="button"` by default, visible focus ring |
| `Input` | text field with label and error | label linked by `id`, `aria-invalid`, error in `aria-describedby` |
| `Checkbox` | checkbox with label | real `<input type="checkbox">` under the custom box |
| `Card` | white panel | none needed |
| `Badge` | small label | text, never colour alone |
| `Icon` | Figma icon set | decorative by default, named with `label` |
| `Dialog` | modal popup | `role="dialog"`, `aria-modal`, named by its title; focus trap, Escape and focus return from `useDialog` |
| `Notice` | message inside the page | `note` for info and warnings, `status` for success, `alert` for errors; not a landmark |
| `Avatar` | picture or initials | decorative: the name is always next to it |
| `StatusPill` | status label (Pending, Approved…) | translated text, never colour alone |
| `Skeleton` | loading placeholder | `aria-busy`, hidden "what is loading" text |
| `EmptyState` | "nothing here yet" block | real heading at the page's level, decorative sign |
| `Tabs` | tab row | WAI-ARIA tabs: `tablist`/`tab`, `aria-selected`, one tab stop, arrow keys, Home and End |
| `TextArea` | text area with a counter | named by its label only; the count is described, and screen readers hear "N characters left" only near the limit |
| `ProgressBar` | progress | `role="progressbar"` with name, min, max and value |

## Rules for pages

1. **Use a component instead of rebuilding it.** If a page needs a popup, a notice, a status or a loading state, it uses `Dialog`, `Notice`, `StatusPill` or `Skeleton`.
2. **A page's look stays its own.** Every component takes the page's classes (`className`, and for some `itemClassName`, `iconClassName`, `countClassName`, `tabClassName`). With them, the page looks exactly as before. Without them, the component uses its default look from `ui.css` (`ui-…` classes).
3. **Colours come from tokens.** No new hex values in a stylesheet when a token fits.
4. **All text is translated.** Components take the translated text from the page; enum values are never shown raw.
5. **Every component has a test** next to it (`*.test.tsx`), including its accessibility behaviour.
