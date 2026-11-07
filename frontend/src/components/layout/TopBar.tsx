import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import searchIcon from "../../assets/figma/search.svg";
import bellIcon from "../../assets/figma/bell.svg";
import NotificationPanel from "../../features/notifications/NotificationPanel";
import PersonAvatar from "../../features/people/PersonAvatar";
import { useCurrentUser } from "../../store/CurrentUserContext";
import { useNotificationCount } from "../../store/NotificationCountContext";
import ConnectionStatus from "./ConnectionStatus";
import LanguageSwitcher from "./LanguageSwitcher";
import UserMenu from "./UserMenu";

// api-plan §10.8: a name to search is at most 64 characters.
const MAX_SEARCH_LENGTH = 64;

interface TopBarProps {
  isMenuOpen?: boolean;
  menuButtonRef?: RefObject<HTMLButtonElement>;
  onMenuClick?: () => void;
}

function TopBar({ isMenuOpen = false, menuButtonRef, onMenuClick }: TopBarProps) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");

  function searchPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const q = searchText.trim();

    if (q) {
      navigate(`/hitchhikers?${new URLSearchParams({ q, role: "all" })}`);
      setSearchText("");
    }
  }

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

      {/* People search from anywhere, like on intra: Enter opens the Hitchhikers page with
          everyone who can be found, council members too (api-plan §10.8, R11). */}
      <form className="topbar__search" role="search" onSubmit={searchPeople}>
        <img className="topbar__search-icon" src={searchIcon} alt="" aria-hidden="true" />

        <input
          type="search"
          name="q"
          value={searchText}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder={t("topbar.searchPlaceholder")}
          aria-label={t("topbar.search")}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </form>

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

        <UserMenu />
      </div>
    </header>
  );
}

export default TopBar;
