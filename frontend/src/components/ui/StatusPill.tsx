import type { ReactNode } from "react";

export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

interface StatusPillProps {
  tone: StatusTone;
  // The translated label: an enum value is never shown raw (AGENTS.md).
  children: ReactNode;
  className?: string;
}

// The rounded label of a status, such as Pending, Approved or Declined (#730). The colours come
// from the palette tokens, each 4.5:1 or more (WCAG AA); the label itself says the status, so the
// colour is never the only sign (WCAG 1.4.1).
function StatusPill({ tone, children, className = "" }: StatusPillProps) {
  // The page's own classes keep its look; without them, the tone's colours.
  const classes = className || `ui-status-pill ui-status-pill--${tone}`;

  return <span className={classes}>{children}</span>;
}

export default StatusPill;
