import type { ReactNode } from "react";

interface EmptyStateProps {
  title: ReactNode;
  text?: ReactNode;
  // A sign above the title ("—", an Icon); decoration only.
  icon?: ReactNode;
  // A link or button that leads on, such as "Create a request".
  action?: ReactNode;
  // The title's level in the page's outline (a box under an h2 uses h3).
  headingLevel?: 2 | 3 | 4;
  // The page's own classes keep its look; without them the design system's look.
  className?: string;
  iconClassName?: string;
}

// What a list says when it has nothing to show yet (#730): a title, a short text and maybe a
// way on. Never shown while the list is still loading or failed to load (#258).
function EmptyState({
  title,
  text,
  icon,
  action,
  headingLevel = 3,
  className = "",
  iconClassName = "",
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <div className={className || "ui-empty-state"}>
      {icon !== undefined && (
        <div className={iconClassName || "ui-empty-state__icon"} aria-hidden="true">
          {icon}
        </div>
      )}
      <Heading>{title}</Heading>
      {text !== undefined && <p>{text}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
