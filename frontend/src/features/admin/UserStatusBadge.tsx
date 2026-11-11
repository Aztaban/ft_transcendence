import { useTranslation } from "react-i18next";

import i18n from "../../i18n";
import type { AdminUser, UserStatus } from "../../types/adminUser";

// The user's roles as translated names, e.g. "Student, Hitchhiker". A deleted account has no
// roles left (api-plan §8.2), shown as a dash.
export function rolesText(user: AdminUser) {
  return user.roles.length > 0
    ? user.roles.map((role) => i18n.t(`roles.${role.name}`)).join(", ")
    : "—";
}

// An account status (api-plan §8.4) as a coloured, translated label.
function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation();

  return (
    <span className={`admin-users__status admin-users__status--${status}`}>
      {t(`adminUsers.statuses.${status}`)}
    </span>
  );
}

export default UserStatusBadge;
