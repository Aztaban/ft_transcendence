import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollableListProps {
  labelledBy: string;
  children: ReactNode;
}

// A Home box's list. A long one scrolls inside its box, so the page stays short, and only then
// it is a tab stop, because a keyboard user has to reach it to scroll.
function ScrollableList({ labelledBy, children }: ScrollableListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const measure = useCallback(() => {
    const list = listRef.current;

    if (list) {
      setIsScrollable(list.scrollHeight > list.clientHeight);
    }
  }, []);

  // After every render: the rows may have changed. Setting the same value again renders nothing.
  useEffect(measure);

  // Any change of the list's size, also one that is not a window resize: the sidebar, the grid
  // columns or a language switch.
  useEffect(() => {
    const list = listRef.current;

    if (!list || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);

      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);

    observer.observe(list);

    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={listRef}
      className="dashboard-requests"
      role="group"
      aria-labelledby={labelledBy}
      tabIndex={isScrollable ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export default ScrollableList;
