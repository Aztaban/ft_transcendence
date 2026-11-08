import { matchPath } from "react-router";

export type LegalDocument = "privacy" | "terms";

// The legal pages the subject requires, in one list for the routes and the footer links.
export const LEGAL_PAGES: readonly { path: string; kind: LegalDocument; titleKey: string }[] = [
  { path: "/privacy", kind: "privacy", titleKey: "legal.privacy.title" },
  { path: "/terms", kind: "terms", titleKey: "legal.terms.title" },
];

// The legal document at a path, matched like a <Route> (case and a trailing slash do not
// matter), so logged out and logged in accept the same URLs.
export function legalDocumentAt(pathname: string): LegalDocument | null {
  return LEGAL_PAGES.find((page) => matchPath(page.path, pathname))?.kind ?? null;
}
