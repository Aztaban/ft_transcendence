import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface LoadErrorProps {
  // What could not be loaded ("Could not load your history. Please try again.").
  children: ReactNode;
  // Asks for the same data again.
  onRetry: () => void;
  // The page's own error class keeps its look (colours, border, spacing).
  className?: string;
}

// A load that failed, with a way to load it again (#371): the same "Try again" on every page,
// announced at once (alert). The page's own class gives the box its look.
function LoadError({ children, onRetry, className = "" }: LoadErrorProps) {
  const { t } = useTranslation();

  return (
    <div className={className ? `ui-load-error ${className}` : "ui-load-error"} role="alert">
      <p>{children}</p>
      <button className="ui-load-error__retry" type="button" onClick={onRetry}>
        {t("common.tryAgain")}
      </button>
    </div>
  );
}

export default LoadError;
