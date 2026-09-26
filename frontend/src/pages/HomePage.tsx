import { Link } from "react-router";

import historyIcon from "../assets/figma/history.svg";
import hitchhikersIcon from "../assets/figma/hitchhikers.svg";
import pendingIcon from "../assets/figma/pending.svg";
import requestIcon from "../assets/figma/request.svg";
import { useRole, type AppRole } from "../store/RoleContext";
import "../styles/dashboard.css";

interface OverviewItem {
  value: string;
  label: string;
  icon: string;
  tone: "turquoise" | "blue" | "yellow" | "mint";
}

interface DashboardDefinition {
  greeting: string;
  overview: OverviewItem[];
  emptyTitle: string;
  emptyStateTitle: string;
  emptyStateText: string;
  historyTitle: string;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  ctaTo: string;
  actionSymbol: string;
  actionAriaLabel: string;
}

const studentDashboard: DashboardDefinition = {
  greeting: "Welcome Back",
  overview: [
    {
      value: "—",
      label: "Pending",
      icon: pendingIcon,
      tone: "turquoise",
    },
    {
      value: "—",
      label: "Completed",
      icon: historyIcon,
      tone: "mint",
    },
    {
      value: "Not scheduled",
      label: "Next evaluation",
      icon: requestIcon,
      tone: "blue",
    },
    {
      value: "Student",
      label: "Workspace",
      icon: hitchhikersIcon,
      tone: "yellow",
    },
  ],
  emptyTitle: "Upcoming Evaluations",
  emptyStateTitle: "Nothing scheduled yet",
  emptyStateText: "Future evaluations will appear here.",
  historyTitle: "History",
  ctaTitle: "NEED AN EVALUATION?",
  ctaText: "Create a new request and add your available time slots.",
  ctaLabel: "New Request",
  ctaTo: "/requests",
  actionSymbol: "+",
  actionAriaLabel: "Create new request",
};

const councilDashboard: DashboardDefinition = {
  greeting: "Welcome Back",
  overview: [
    {
      value: "—",
      label: "New messages",
      icon: requestIcon,
      tone: "turquoise",
    },
    {
      value: "—",
      label: "History",
      icon: historyIcon,
      tone: "mint",
    },
    {
      value: "—",
      label: "Hitchhikers",
      icon: hitchhikersIcon,
      tone: "blue",
    },
    {
      value: "Council",
      label: "Workspace",
      icon: pendingIcon,
      tone: "yellow",
    },
  ],
  emptyTitle: "Messages",
  emptyStateTitle: "No messages yet",
  emptyStateText: "New anonymous messages will appear here.",
  historyTitle: "History",
  ctaTitle: "STUDENT COUNCIL",
  ctaText: "Review anonymous messages sent to the council.",
  ctaLabel: "View Messages",
  ctaTo: "/council/messages",
  actionSymbol: "→",
  actionAriaLabel: "View council messages",
};

const dashboards: Record<AppRole, DashboardDefinition> = {
  STUDENT: studentDashboard,
  HITCHHIKER: studentDashboard,
  COUNCIL: councilDashboard,
};

function HomePage() {
  const { activeRole } = useRole();
  const dashboard = dashboards[activeRole];

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <h1>{dashboard.greeting}</h1>
      </header>

      <section className="dashboard__section dashboard__overview-section">
        <div className="dashboard__section-heading">
          <h2>Overview</h2>
        </div>

        <div className="dashboard-overview">
          {dashboard.overview.map((item) => (
            <article
              className={`dashboard-overview__card dashboard-overview__card--${item.tone}`}
              key={item.label}
            >
              <div className="dashboard-overview__icon">
                <img src={item.icon} alt="" aria-hidden="true" />
              </div>

              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard__columns">
        <section className="dashboard__section">
          <h2>{dashboard.emptyTitle}</h2>

          <div className="dashboard-empty">
            <Link
              className="dashboard-empty__add"
              to={dashboard.ctaTo}
              aria-label={dashboard.actionAriaLabel}
            >
              {dashboard.actionSymbol}
            </Link>
            <h3>{dashboard.emptyStateTitle}</h3>
            <p>{dashboard.emptyStateText}</p>
          </div>
        </section>

        <section className="dashboard__section">
          <h2>{dashboard.historyTitle}</h2>

          <div className="dashboard-empty">
            <div className="dashboard-empty__history-mark">—</div>
            <h3>No history yet</h3>
            <p>Your recent activity will appear here.</p>
          </div>
        </section>
      </div>

      <section className="dashboard-cta">
        <div>
          <h2>{dashboard.ctaTitle}</h2>
          <p>{dashboard.ctaText}</p>
        </div>

        <Link className="dashboard-cta__button" to={dashboard.ctaTo}>
          <span>{dashboard.actionSymbol}</span>
          {dashboard.ctaLabel}
        </Link>
      </section>
    </section>
  );
}

export default HomePage;
