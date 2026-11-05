import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import logoutIcon from "../../assets/figma/logout.svg";
import userChevron from "../../assets/figma/user-chevron.svg";
import { useAuth } from "../../store/AuthContext";

// The arrow next to the user's name: opens a small menu with "Logout", the same action and
// texts as the sidebar button (POST /auth/logout/, then the login page). Closes on Escape (focus
// back on the arrow) or a click outside it.
function UserMenu() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  function toggle() {
    setLogoutFailed(false);
    setIsOpen((open) => !open);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutFailed(false);

    try {
      await logout();
      navigate("/login");
    } catch {
      setLogoutFailed(true);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div ref={menuRef} className="topbar__user-menu-wrap">
      <button
        ref={buttonRef}
        className={isOpen ? "topbar__user-menu topbar__user-menu--open" : "topbar__user-menu"}
        type="button"
        aria-label={isOpen ? t("topbar.closeUserMenu") : t("topbar.userMenu")}
        aria-expanded={isOpen}
        aria-controls={isOpen ? "user-menu" : undefined}
        onClick={toggle}
      >
        <img src={userChevron} alt="" aria-hidden="true" />
      </button>

      {isOpen && (
        <div id="user-menu" className="user-menu">
          <button
            className="user-menu__item"
            type="button"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            <img src={logoutIcon} alt="" aria-hidden="true" />
            <span>{isLoggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}</span>
          </button>

          {logoutFailed && (
            <p className="user-menu__error" role="alert">
              {t("sidebar.logoutFailed")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default UserMenu;
