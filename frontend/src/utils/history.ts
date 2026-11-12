// True when the entry before this one in the tab's history is a page of the app, so
// `navigate(-1)` stays inside it (#374). React Router numbers its entries in `history.state.idx`,
// from 0 for the first page of the app, and keeps the number on a `replace` (the redirects around
// login). `location.key` is no help: a replaced page gets a new key, so a page opened from a pasted
// link looked as if it had a page before it. MemoryRouter (tests) keeps no such state: false.
export function canGoBackInApp(): boolean {
  const index = (window.history.state as { idx?: unknown } | null)?.idx;

  return typeof index === "number" && index > 0;
}
