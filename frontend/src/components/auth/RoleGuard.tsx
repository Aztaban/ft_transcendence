import type { ReactNode } from "react";

import { useRole, type AppRole } from "../../store/RoleContext";
import { hasRolePermission } from "../../utils/permissions";

interface RoleGuardProps {
  allowedRoles: readonly AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { activeRole } = useRole();

  if (!hasRolePermission(activeRole, allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default RoleGuard;
