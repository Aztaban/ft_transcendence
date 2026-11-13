import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";

import { canGoBackInApp } from "../../utils/history";

interface BackLinkProps {
  className: string;
}

// "‹ Back" to the page the user came from (Pending, History, a notification…), like the
// browser's Back button (#374). A page opened directly, with nothing before it in the app,
// offers "‹ Back to home" instead. Still a real link to Home, so it also works when opened in a
// new tab.
function BackLink({ className }: BackLinkProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Read on every navigation: the same page can be reached with or without one before it.
  useLocation();
  const cameFromApp = canGoBackInApp();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (cameFromApp && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      navigate(-1);
    }
  }

  return (
    <Link className={className} to="/" onClick={goBack}>
      <span aria-hidden="true">‹</span> {cameFromApp ? t("common.back") : t("common.backToHome")}
    </Link>
  );
}

export default BackLink;
