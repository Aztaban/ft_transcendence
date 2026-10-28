import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import searchIcon from "../../assets/figma/search.svg";
import bellIcon from "../../assets/figma/bell.svg";
import userChevron from "../../assets/figma/user-chevron.svg";
import PersonAvatar from "../../features/people/PersonAvatar";
import { useCurrentUser } from "../../store/CurrentUserContext";
import { useNotificationCount } from "../../store/NotificationCountContext";
import ConnectionStatus from "./ConnectionStatus";
import LanguageSwitcher from "./LanguageSwitcher";

interface TopBarProps {
  isMenuOpen?: boolean;
  menuButtonRef?: RefObject<HTMLButtonElement>;
  onMenuClick?: () => void;
}

function TopBar({ isMenuOpen = false, menuButtonRef, onMenuClick }: TopBarProps) {
  // The logged-in user from GET /users/me/ (§8.2); `null` until it has answered.
  const { user } = useCurrentUser();
  const { t } = useTranslation();
  // Unread notifications (§10.5); 0 until loaded and when logged out, and then no badge is shown.
  const { unreadCount } = useNotificationCount();

  return (
    <header className="topbar">
      {/* Shown on small screens only, where the sidebar is a drawer. */}
      <button
        ref={menuButtonRef}
        className="topbar__menu"
        type="button"
        aria-label={isMenuOpen ? t("topbar.closeMenu") : t("topbar.openMenu")}
        aria-controls="app-sidebar"
        aria-expanded={isMenuOpen}
        onClick={onMenuClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <label className="topbar__search">
        <img className="topbar__search-icon" src={searchIcon} alt="" aria-hidden="true" />

        <input
          type="search"
          placeholder={t("topbar.searchPlaceholder")}
          aria-label={t("topbar.search")}
        />
      </label>

      <div className="topbar__user">
        <ConnectionStatus />

        <LanguageSwitcher />

        <button
          className="topbar__notification"
          type="button"
          aria-label={
            unreadCount > 0
              ? t("topbar.notificationsUnread", { count: unreadCount })
              : t("topbar.notifications")
          }
        >
          <img src={bellIcon} alt="" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="topbar__notification-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <PersonAvatar
          className="topbar__avatar"
          name={user?.display_name ?? ""}
          avatarUrl={user?.avatar_url ?? null}
        />

        {user && <span className="topbar__username">{user.display_name}</span>}

        <button className="topbar__user-menu" type="button" aria-label={t("topbar.userMenu")}>
          <img src={userChevron} alt="" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
