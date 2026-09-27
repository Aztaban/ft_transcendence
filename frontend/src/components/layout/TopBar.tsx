import searchIcon from "../../assets/figma/search.svg";
import bellIcon from "../../assets/figma/bell.svg";
import avatarImage from "../../assets/figma/avatar.png";
import userChevron from "../../assets/figma/user-chevron.svg";

function TopBar() {
  return (
    <header className="topbar">
      <label className="topbar__search">
        <img className="topbar__search-icon" src={searchIcon} alt="" aria-hidden="true" />

        <input type="search" placeholder="search" aria-label="Search" />
      </label>

      <div className="topbar__user">
        <button className="topbar__notification" type="button" aria-label="Notifications">
          <img src={bellIcon} alt="" aria-hidden="true" />
          <span className="topbar__notification-dot" />
        </button>

        <img className="topbar__avatar" src={avatarImage} alt="" aria-hidden="true" />

        <span className="topbar__username">dkolarov</span>

        <button className="topbar__user-menu" type="button" aria-label="Open user menu">
          <img src={userChevron} alt="" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
