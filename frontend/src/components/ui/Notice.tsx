import type { ReactNode } from "react";

export type NoticeTone = "info" | "success" | "warning" | "error";

interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  // A short sign before the text ("i", "!", "✓"); decoration only.
  icon?: ReactNode;
  className?: string;
}

// What each tone is for screen readers: an error is announced at once (alert), a success
// politely (status), and information or a warning is part of the page (note) (#730).
const ROLES: Record<NoticeTone, "alert" | "status" | "note"> = {
  info: "note",
  success: "status",
  warning: "note",
  error: "alert",
};

// A message inside the page (#730). Not a landmark of its own: it sits inside <main> (#319).
function Notice({ tone = "info", children, icon, className = "" }: NoticeProps) {
  // The page's own class keeps its look; without one, the tone's colours from the design system.
  const classes = className || `ui-notice ui-notice--${tone}`;

  return (
    <div role={ROLES[tone]} className={classes}>
      {icon !== undefined && (
        <span className="ui-notice__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="ui-notice__text">{children}</div>
    </div>
  );
}

export default Notice;
