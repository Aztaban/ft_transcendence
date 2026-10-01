import { useState } from "react";
import { NavLink } from "react-router";

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
import { roles, useRole, type AppRole } from "../../store/RoleContext";

interface NavigationItem {
  label: string;
  to: string;
  icon: string;
}

const navigationByRole: Record<AppRole, NavigationItem[]> = {
  STUDENT: [
    { label: "Home", to: "/", icon: homeIcon },
    { label: "Request", to: "/requests", icon: requestIcon },
    { label: "Pending", to: "/pending", icon: pendingIcon },
    { label: "Hitchhikers", to: "/hitchhikers", icon: hitchhikersIcon },
    { label: "Profile", to: "/profile", icon: profileIcon },
    { label: "Student Council", to: "/council", icon: councilIcon },
  ],

  HITCHHIKER: [
    { label: "Home", to: "/", icon: homeIcon },
    { label: "Requests", to: "/requests", icon: requestIcon },
    { label: "Pending", to: "/pending", icon: pendingIcon },
    { label: "Student Council", to: "/council", icon: councilIcon },
    { label: "Profile", to: "/profile", icon: profileIcon },
  ],

  COUNCIL: [
    { label: "Home", to: "/", icon: homeIcon },
    { label: "Messages", to: "/council/messages", icon: councilIcon },
    { label: "History", to: "/council/history", icon: historyIcon },
    { label: "Hitchhikers", to: "/hitchhikers", icon: hitchhikersIcon },
    { label: "Council Profile", to: "/council", icon: profileIcon },
  ],
};

function Sidebar() {
  const { activeRole, setActiveRole } = useRole();
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  const visibleNavigation = navigationByRole[activeRole];

  const selectRole = (role: AppRole) => {
    setActiveRole(role);
    setIsRoleMenuOpen(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img className="sidebar__brand-logo" src={logo42} alt="42" />
        <span className="sidebar__brand-name">EVALS</span>
      </div>

      <div className="sidebar__middle">
        <nav className="sidebar__nav" aria-label="Primary navigation">
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

              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__role">
          <button
            className="sidebar__role-selector"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isRoleMenuOpen}
            onClick={() => setIsRoleMenuOpen((open) => !open)}
          >
            <span>{activeRole}</span>

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
            <div className="sidebar__role-menu" role="listbox" aria-label="Select role">
              {roles.map((role) => (
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
                  aria-selected={activeRole === role}
                  onClick={() => selectRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar__bottom">
        <img className="sidebar__divider" src={sidebarLine} alt="" aria-hidden="true" />

        <button className="sidebar__logout" type="button">
          <span>Logout</span>
          <img src={logoutIcon} alt="" aria-hidden="true" />
        </button>

        <div className="sidebar__external" aria-label="External tools">
          <a
            href="https://profile.intra.42.fr/"
            target="_blank"
            rel="noreferrer"
            aria-label="Open 42 Intra"
          >
            <img className="sidebar__external-intra" src={intraLogo} alt="42 Intra" />
          </a>

          <a
            href="https://www.notion.so/"
            target="_blank"
            rel="noreferrer"
            aria-label="Open Notion"
          >
            <img className="sidebar__external-notion" src={notionLogo} alt="Notion" />
          </a>

          <a href="https://slack.com/" target="_blank" rel="noreferrer" aria-label="Open Slack">
            <img className="sidebar__external-slack" src={slackLogo} alt="Slack" />
          </a>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
