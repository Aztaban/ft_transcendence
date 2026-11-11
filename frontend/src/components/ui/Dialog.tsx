import type { ReactNode } from "react";

import useDialog from "../../hooks/useDialog";

interface DialogProps {
  // Id of the element inside that names the dialog (its title).
  titleId: string;
  // Id of the element that describes it, when there is one.
  describedById?: string;
  onClose: () => void;
  children: ReactNode;
  // Classes of the card and of the backdrop behind it; the page's own styles.
  className?: string;
  backdropClassName?: string;
  // false: a click outside the card does nothing. Escape still calls `onClose`; a popup that must
  // not close (while saving, say) ignores that call in its own `onClose`.
  closeOnBackdrop?: boolean;
  backdropTestId?: string;
}

// A modal popup (#730): a backdrop and a card with role="dialog" and aria-modal, named by its
// title. With the page's own classes it looks exactly as before; without them it gets the design
// system's look (ui-dialog). The keyboard behaviour comes from useDialog (#320): the card takes
// the focus, Tab stays inside, Escape calls `onClose`, and the focus goes back to the opener.
function Dialog({
  titleId,
  describedById,
  onClose,
  children,
  className = "",
  backdropClassName = "",
  closeOnBackdrop = true,
  backdropTestId,
}: DialogProps) {
  const cardRef = useDialog<HTMLDivElement>(onClose);

  return (
    <div
      className={backdropClassName || "ui-dialog"}
      data-testid={backdropTestId}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={cardRef}
        className={className || "ui-dialog__card"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Dialog;
