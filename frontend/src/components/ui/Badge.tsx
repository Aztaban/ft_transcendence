import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "neutral" | "accent" | "success" | "warning";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

function Badge({ children, variant = "neutral", className = "", ...props }: BadgeProps) {
  const classes = ["ui-badge", `ui-badge--${variant}`, className].filter(Boolean).join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

export default Badge;
