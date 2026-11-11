interface ProgressBarProps {
  // Names the bar for screen readers ("Request progress").
  label: string;
  value: number;
  min?: number;
  max?: number;
  // The page's own class keeps its look; without it the design system's look.
  className?: string;
}

// How far something has got (#730): role="progressbar" with its value for screen readers, and a
// filled bar of value / max for everyone else.
function ProgressBar({ label, value, min = 0, max = 100, className = "" }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      className={className || "ui-progress"}
      role="progressbar"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export default ProgressBar;
