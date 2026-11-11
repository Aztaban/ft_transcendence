import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<Id extends string> {
  id: Id;
  label: ReactNode;
}

interface TabsProps<Id extends string> {
  items: readonly TabItem<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  // Names the tab list for screen readers ("Filter by status").
  label: string;
  // Id of the panel the tabs control, when the page has one.
  panelId?: string;
  // The page's own classes keep its look; without them the design system's look.
  className?: string;
  tabClassName?: (id: Id, isSelected: boolean) => string;
}

// A row of tabs (#730), as the WAI-ARIA tabs pattern describes: one tab stop for the whole list,
// the arrow keys move between tabs and select them, Home and End go to the first and last one.
function Tabs<Id extends string>({
  items,
  selected,
  onSelect,
  label,
  panelId,
  className = "",
  tabClassName,
}: TabsProps<Id>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % items.length
        : event.key === "ArrowLeft"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;

    if (next === null) {
      return;
    }

    event.preventDefault();
    tabRefs.current[next]?.focus();
    onSelect(items[next].id);
  }

  return (
    <div className={className || "ui-tabs"} role="tablist" aria-label={label}>
      {items.map((item, index) => {
        const isSelected = item.id === selected;

        return (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            className={
              tabClassName?.(item.id, isSelected) ??
              (isSelected ? "ui-tabs__tab ui-tabs__tab--selected" : "ui-tabs__tab")
            }
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={panelId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
