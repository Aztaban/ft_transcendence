import type { ReactNode } from "react";

interface InfoNoticeProps {
  children: ReactNode;
}

// The yellow "i" notice from the Create New Request design.
function InfoNotice({ children }: InfoNoticeProps) {
  return (
    <aside className="info-notice">
      <span className="info-notice__icon" aria-hidden="true">
        i
      </span>
      <div className="info-notice__text">{children}</div>
    </aside>
  );
}

export default InfoNotice;
