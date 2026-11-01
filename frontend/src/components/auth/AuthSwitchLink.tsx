import { Link } from "react-router";

import type { ReturnPage } from "../../utils/loginReturn";

interface AuthSwitchLinkProps {
  prompt: string;
  label: string;
  to: string;
  // The page the login gate sent the user away from (#328): it travels with them.
  from?: ReturnPage;
  // True while the page's form is being sent, so its answer still has a page to arrive on.
  disabled?: boolean;
}

// The way between Login and Register, e.g. "Don't have an account? Create one →". It replaces the
// history entry: the Back button leaves the two pages instead of walking through them.
function AuthSwitchLink({ prompt, label, to, from, disabled = false }: AuthSwitchLinkProps) {
  return (
    <p className="registration-switch">
      {prompt}{" "}
      <Link
        to={to}
        replace
        state={from ? { from } : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        {label} <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}

export default AuthSwitchLink;
