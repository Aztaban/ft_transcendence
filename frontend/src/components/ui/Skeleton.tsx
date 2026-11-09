interface SkeletonProps {
  // What is loading, for screen readers ("Loading your requests…").
  label: string;
  // How many grey placeholder blocks are shown.
  count?: number;
  // The page's own classes for the group and for each block.
  className?: string;
  itemClassName?: string;
}

// Placeholder blocks while data loads (#730, #258): the group is aria-busy, the blocks are
// decoration, and a hidden text says what is loading. The page's classes keep its own look.
function Skeleton({ label, count = 2, className = "", itemClassName = "" }: SkeletonProps) {
  return (
    <div className={className || "ui-skeleton"} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={itemClassName || "ui-skeleton__item"} />
      ))}
      <span className="ui-sr-only">{label}</span>
    </div>
  );
}

export default Skeleton;
