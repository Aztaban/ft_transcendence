import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import searchIcon from "../../assets/figma/search.svg";
import bellIcon from "../../assets/figma/bell.svg";
import userChevron from "../../assets/figma/user-chevron.svg";
import NotificationPanel from "../../features/notifications/NotificationPanel";
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
  // The notification center under the bell (#272).
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // An open notification center closes on Escape (focus back on the bell) or a click outside it.
  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
        bellRef.current?.focus();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isPanelOpen]);

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

        <div ref={notificationsRef} className="topbar__notifications">
          <button
            ref={bellRef}
            className="topbar__notification"
            type="button"
            aria-label={
              unreadCount > 0
                ? t("topbar.notificationsUnread", { count: unreadCount })
                : t("topbar.notifications")
            }
            aria-expanded={isPanelOpen}
            aria-controls="notification-panel"
            onClick={() => setIsPanelOpen((open) => !open)}
          >
            <img src={bellIcon} alt="" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="topbar__notification-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {isPanelOpen && <NotificationPanel onClose={() => setIsPanelOpen(false)} />}
        </div>

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
