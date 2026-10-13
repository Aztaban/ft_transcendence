import { useEffect, useRef } from "react";

// Focuses the dialog card once when it opens and closes it on Escape. `onClose` is read from a
// ref, so a new function on each render does not move the focus back to the card.
function useDialog<T extends HTMLElement>(onClose: () => void) {
  const cardRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    cardRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return cardRef;
}

export default useDialog;
