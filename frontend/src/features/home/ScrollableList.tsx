import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollableListProps {
  labelledBy: string;
  children: ReactNode;
}

// A Home box's list. A long one scrolls inside its box, so the page stays short, and only then
// it is a tab stop, because a keyboard user has to reach it to scroll.
function ScrollableList({ labelledBy, children }: ScrollableListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    function measure() {
      const list = listRef.current;

      if (list) {
        setIsScrollable(list.scrollHeight > list.clientHeight);
      }
    }

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [children]);

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
