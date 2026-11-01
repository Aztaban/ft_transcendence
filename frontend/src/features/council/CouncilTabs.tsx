import { useTranslation } from "react-i18next";
import { Link } from "react-router";

interface CouncilTabsProps {
  // The list that is open; the other tab links to its page.
  active: "new" | "history";
}

const tabs = [
  { key: "new", to: "/council/inbox", labelKey: "council.tabNew" },
  { key: "history", to: "/council/history", labelKey: "council.tabHistory" },
] as const;

// "New" (/council/inbox) and "History" (/council/history) above the council's message lists (#279).
function CouncilTabs({ active }: CouncilTabsProps) {
  const { t } = useTranslation();

  return (
    <nav className="council-tabs" aria-label={t("council.tabsAria")}>
      {tabs.map((tab) =>
        tab.key === active ? (
          <span
            key={tab.key}
            className="council-tabs__tab council-tabs__tab--active"
            aria-current="page"
          >
            {t(tab.labelKey)}
          </span>
        ) : (
          <Link key={tab.key} className="council-tabs__tab" to={tab.to}>
            {t(tab.labelKey)}
          </Link>
        ),
      )}
    </nav>
  );
}

export default CouncilTabs;
