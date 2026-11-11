import { useEffect, type ReactNode } from "react";

import { useCurrentUser } from "../../store/CurrentUserContext";
import { useRole, type AppRole } from "../../store/RoleContext";
import { hasRolePermission } from "../../utils/permissions";

interface RoleGuardProps {
  allowedRoles: readonly AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
  // For pages that links lead to from anywhere (notifications): when the user has an allowed
  // workspace but another one is active, switch to it instead of showing the fallback.
  switchWorkspace?: boolean;
}

function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
  switchWorkspace = false,
}: RoleGuardProps) {
  const { activeRole, setActiveRole, availableRoles } = useRole();
  const { isLoaded, loadFailed } = useCurrentUser();
  const isAllowed = hasRolePermission(activeRole, allowedRoles);
  // Only once /users/me/ has answered: until then every workspace counts as available.
  const target =
    switchWorkspace && !isAllowed && isLoaded
      ? allowedRoles.find((role) => availableRoles.includes(role))
      : undefined;

  useEffect(() => {
    if (target) {
      setActiveRole(target);
    }
  }, [target, setActiveRole]);

  // A workspace other than Student is restored from the tab's storage: it only counts once
  // /users/me/ has answered and still gives that workspace, so a page never asks the API with a
  // role the user lost (403s in the console, #770). RoleProvider moves a lost workspace back to
  // Student only in its effect, after this render. Every account is a student, so that one needs
  // no wait. If /users/me/ failed, the page shows and reports its own load error.
  const isConfirmed =
    activeRole === "STUDENT" || (isLoaded && availableRoles.includes(activeRole)) || loadFailed;

  if (isAllowed) {
    return isConfirmed ? <>{children}</> : null;
  }

  // Waiting for the user's roles, or switching: nothing yet (no API call, no Unauthorized flash).
  if (switchWorkspace && (!isLoaded || target)) {
    return null;
  }

  return <>{fallback}</>;
}

export default RoleGuard;
