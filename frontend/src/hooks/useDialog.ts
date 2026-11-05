import { useEffect, useRef } from "react";

// What Tab can reach inside a popup.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keyboard behaviour shared by every popup (WCAG 2.4.3, #320): the card gets the focus when the
// popup opens, Tab and Shift+Tab stay inside it, Escape closes it, and on close the focus goes
// back to the element that opened it. `onClose` is read from a ref, so a new function on each
// render does not move the focus back to the card. A popup that must not close while it is
// busy ignores the call in its own `onClose`.
function useDialog<T extends HTMLElement>(onClose: () => void) {
  const cardRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    cardRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      const card = cardRef.current;

      if (event.key !== "Tab" || !card) {
        return;
      }

      const focusable = [...card.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = document.activeElement;

      if (focusable.length === 0) {
        event.preventDefault();
        card.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !card.contains(active);

      if (event.shiftKey && (active === first || active === card || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      // Back to the button that opened the popup, unless it left the page meanwhile.
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  return cardRef;
}

export default useDialog;
