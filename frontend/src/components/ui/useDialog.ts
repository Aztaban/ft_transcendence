import { useEffect, useRef } from "react";

// What Tab can reach inside a popup.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogOptions {
  // While false, Escape does nothing, e.g. while the popup is sending a request.
  closeOnEscape?: boolean;
}

// Keyboard behaviour shared by every popup (WCAG 2.4.3, #320): the card gets the focus when the
// popup opens, Tab and Shift+Tab stay inside it, Escape closes it, and on close the focus goes
// back to the element that opened it. `onClose` and the options are read from refs, so new
// values on each render do not move the focus.
function useDialog<T extends HTMLElement>(
  onClose: () => void,
  { closeOnEscape = true }: DialogOptions = {},
) {
  const cardRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);

  onCloseRef.current = onClose;
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    cardRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (closeOnEscapeRef.current) {
          onCloseRef.current();
        }

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
