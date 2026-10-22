import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router";

import logo42 from "../../assets/figma/42.svg";
import homeIcon from "../../assets/figma/home.svg";
import requestIcon from "../../assets/figma/request.svg";
import pendingIcon from "../../assets/figma/pending.svg";
import historyIcon from "../../assets/figma/history.svg";
import councilIcon from "../../assets/figma/student-council.svg";
import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import profileIcon from "../../assets/figma/profile.svg";
import roleChevron from "../../assets/figma/role-chevron.svg";
import logoutIcon from "../../assets/figma/logout.svg";
import sidebarLine from "../../assets/figma/sidebar-line.svg";
import intraLogo from "../../assets/figma/intra.png";
import notionLogo from "../../assets/figma/notion.svg";
import slackLogo from "../../assets/figma/slack.svg";
import { useAuth } from "../../store/AuthContext";
import { useCurrentUser } from "../../store/CurrentUserContext";
import { useRole, type AppRole } from "../../store/RoleContext";
import { canReviewEligibility } from "../../utils/permissions";

interface NavigationItem {
  // A key of the "nav" texts in src/i18n/locales.
  labelKey: string;
  to: string;
  icon: string;
}

const navigationByRole: Record<AppRole, NavigationItem[]> = {
  STUDENT: [
    { labelKey: "nav.home", to: "/", icon: homeIcon },
    { labelKey: "nav.request", to: "/requests", icon: requestIcon },
    { labelKey: "nav.pending", to: "/pending", icon: pendingIcon },
    { labelKey: "nav.history", to: "/history", icon: historyIcon },
    { labelKey: "nav.hitchhikers", to: "/hitchhikers", icon: hitchhikersIcon },
    { labelKey: "nav.profile", to: "/profile", icon: profileIcon },
    { labelKey: "nav.studentCouncil", to: "/council", icon: councilIcon },
  ],

  HITCHHIKER: [
    { labelKey: "nav.home", to: "/", icon: homeIcon },
    { labelKey: "nav.requests", to: "/requests", icon: requestIcon },
    { labelKey: "nav.pending", to: "/pending", icon: pendingIcon },
    { labelKey: "nav.history", to: "/history", icon: historyIcon },
    { labelKey: "nav.studentCouncil", to: "/council", icon: councilIcon },
    { labelKey: "nav.profile", to: "/profile", icon: profileIcon },
  ],

  COUNCIL: [
    { labelKey: "nav.home", to: "/", icon: homeIcon },
    { labelKey: "nav.messages", to: "/council/messages", icon: councilIcon },
    { labelKey: "nav.history", to: "/council/history", icon: historyIcon },
    { labelKey: "nav.hitchhikers", to: "/hitchhikers", icon: hitchhikersIcon },
    { labelKey: "nav.councilProfile", to: "/council", icon: profileIcon },
  ],
};

const eligibilityItem: NavigationItem = {
  labelKey: "nav.eligibility",
  to: "/eligibility-requests",
  icon: hitchhikersIcon,
};

interface SidebarProps {
  // Small screens only: the sidebar is a drawer that the top bar opens.
  isOpen?: boolean;
}

function Sidebar({ isOpen = false }: SidebarProps) {
  const { t } = useTranslation();
  const { activeRole, setActiveRole, availableRoles } = useRole();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const roleButtonRef = useRef<HTMLButtonElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Head Tutors and Admins also review eligibility requests in the Hitchhiker workspace.
  const { roles: userRoles } = useCurrentUser();
  const visibleNavigation =
    activeRole === "HITCHHIKER" && canReviewEligibility(userRoles)
      ? [...navigationByRole.HITCHHIKER, eligibilityItem]
      : navigationByRole[activeRole];

  // Opening the drawer moves the focus to its first link.
  useEffect(() => {
    if (isOpen) {
      navRef.current?.querySelector("a")?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!logoutError) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLogoutError(false);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [logoutError]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(false);

    try {
      await logout();
      navigate("/login");
    } catch {
      setLogoutError(true);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const selectRole = (role: AppRole) => {
    setActiveRole(role);
    setIsRoleMenuOpen(false);
    roleButtonRef.current?.focus();
  };

  // Opening the role menu moves the focus to the current workspace.
  useEffect(() => {
    if (isRoleMenuOpen) {
      roleMenuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    }
  }, [isRoleMenuOpen]);

  // The role menu is a listbox (WAI-ARIA): arrow keys, Home and End move between the
  // workspaces, Escape closes it and returns to the button, Tab closes it and moves on.
  const handleRoleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = [
      ...(roleMenuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
    ];
    const index = options.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = {
      ArrowDown: (index + 1) % options.length,
      ArrowUp: (index - 1 + options.length) % options.length,
      Home: 0,
      End: options.length - 1,
    };

    if (event.key in moves) {
      event.preventDefault();
      options[moves[event.key]]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsRoleMenuOpen(false);
      roleButtonRef.current?.focus();
    } else if (event.key === "Tab") {
      setIsRoleMenuOpen(false);
    }
  };

  return (
    <aside
      id="app-sidebar"
      className={["sidebar", isOpen ? "sidebar--open" : ""].filter(Boolean).join(" ")}
    >
      <div className="sidebar__brand">
        <img className="sidebar__brand-logo" src={logo42} alt="42" />
        <span className="sidebar__brand-name">EVALS</span>
      </div>

      <div className="sidebar__middle">
        <nav ref={navRef} className="sidebar__nav" aria-label={t("nav.primary")}>
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                ["sidebar__nav-link", isActive ? "sidebar__nav-link--active" : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <span className="sidebar__nav-icon">
                <img src={item.icon} alt="" aria-hidden="true" />
              </span>

              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__role">
          <button
            ref={roleButtonRef}
            className="sidebar__role-selector"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isRoleMenuOpen}
            onClick={() => setIsRoleMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setIsRoleMenuOpen(true);
              }
            }}
          >
            <span>{t(`workspace.${activeRole}`)}</span>

            <img
              className={[
                "sidebar__role-chevron",
                isRoleMenuOpen ? "sidebar__role-chevron--open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              src={roleChevron}
              alt=""
              aria-hidden="true"
            />
          </button>

          {isRoleMenuOpen && (
            <div
              ref={roleMenuRef}
              className="sidebar__role-menu"
              role="listbox"
              aria-label={t("workspace.select")}
              onKeyDown={handleRoleMenuKeyDown}
            >
              {availableRoles.map((role) => (
                <button
                  key={role}
                  className={[
                    "sidebar__role-option",
                    activeRole === role ? "sidebar__role-option--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={activeRole === role}
                  onClick={() => selectRole(role)}
                >
                  {t(`workspace.${role}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar__bottom">
        <img className="sidebar__divider" src={sidebarLine} alt="" aria-hidden="true" />

        <button
          className="sidebar__logout"
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
        >
          <span>{isLoggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}</span>
          <img src={logoutIcon} alt="" aria-hidden="true" />
        </button>

        {logoutError && (
          <div className="sidebar__logout-toast" role="alert">
            {t("sidebar.logoutFailed")}
          </div>
        )}

        <div className="sidebar__external" aria-label={t("sidebar.externalTools")}>
          <a
            href="https://profile.intra.42.fr/"
            target="_blank"
            rel="noreferrer"
            aria-label={t("sidebar.openIntra")}
          >
            <img className="sidebar__external-intra" src={intraLogo} alt="42 Intra" />
          </a>

          <a
            href="https://www.notion.so/"
            target="_blank"
            rel="noreferrer"
            aria-label={t("sidebar.openNotion")}
          >
            <img className="sidebar__external-notion" src={notionLogo} alt="Notion" />
          </a>

          <a
            href="https://slack.com/"
            target="_blank"
            rel="noreferrer"
            aria-label={t("sidebar.openSlack")}
          >
            <img className="sidebar__external-slack" src={slackLogo} alt="Slack" />
          </a>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
