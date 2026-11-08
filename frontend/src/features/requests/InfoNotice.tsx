import type { ReactNode } from "react";

interface InfoNoticeProps {
  children: ReactNode;
}

// The yellow "i" notice from the Create New Request design. A note inside the page, not a
// landmark of its own: it sits inside <main> (WCAG 1.3.1, #319).
function InfoNotice({ children }: InfoNoticeProps) {
  return (
    <div role="note" className="info-notice">
      <span className="info-notice__icon" aria-hidden="true">
        i
      </span>
      <div className="info-notice__text">{children}</div>
    </div>
  );
}

export default InfoNotice;
