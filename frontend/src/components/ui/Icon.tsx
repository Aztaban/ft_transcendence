import bell from "../../assets/figma/bell.svg";
import history from "../../assets/figma/history.svg";
import hitchhikers from "../../assets/figma/hitchhikers.svg";
import home from "../../assets/figma/home.svg";
import logout from "../../assets/figma/logout.svg";
import pending from "../../assets/figma/pending.svg";
import profile from "../../assets/figma/profile.svg";
import request from "../../assets/figma/request.svg";
import roleChevron from "../../assets/figma/role-chevron.svg";
import search from "../../assets/figma/search.svg";
import studentCouncil from "../../assets/figma/student-council.svg";
import userChevron from "../../assets/figma/user-chevron.svg";

// The icon set of the design system (#731): the line icons from the Figma file. The 42, Notion
// and Slack logos are brand marks, not icons, and stay as they are.
const ICONS = {
  bell,
  history,
  hitchhikers,
  home,
  logout,
  pending,
  profile,
  request,
  roleChevron,
  search,
  studentCouncil,
  userChevron,
};

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

interface IconProps {
  name: IconName;
  // Width and height in pixels. Without it, the CSS of the place it is used decides.
  size?: number;
  // Only for an icon that carries meaning on its own. Next to a text, an icon is decoration and
  // screen readers skip it.
  label?: string;
  className?: string;
}

function Icon({ name, size, label, className = "" }: IconProps) {
  return (
    <img
      className={["ui-icon", className].filter(Boolean).join(" ")}
      src={ICONS[name]}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
    />
  );
}

export default Icon;
