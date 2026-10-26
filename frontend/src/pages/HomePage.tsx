import { Link } from "react-router";

import historyIcon from "../assets/figma/history.svg";
import hitchhikersIcon from "../assets/figma/hitchhikers.svg";
import pendingIcon from "../assets/figma/pending.svg";
import requestIcon from "../assets/figma/request.svg";
import AwaitingConfirmation from "../features/hitchhiker/AwaitingConfirmation";
import EvaluationHistory from "../features/hitchhiker/EvaluationHistory";
import OpenRequestQueue from "../features/hitchhiker/OpenRequestQueue";
import ScheduledEvaluations from "../features/hitchhiker/ScheduledEvaluations";
import { useHitchhikerRequests } from "../features/hitchhiker/useHitchhikerRequests";
import OpenRequests from "../features/student/OpenRequests";
import { useStudentRequests } from "../features/student/useStudentRequests";
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

const hitchhikerDashboard: DashboardDefinition = {
  greeting: "Welcome Back",
  overview: [
    {
      value: "—",
      label: "Open requests",
      icon: requestIcon,
      tone: "turquoise",
    },
    {
      value: "—",
      label: "Awaiting confirmation",
      icon: pendingIcon,
      tone: "blue",
    },
    {
      value: "—",
      label: "Evaluations done",
      icon: historyIcon,
      tone: "mint",
    },
    {
      value: "Hitchhiker",
      label: "Workspace",
      icon: hitchhikersIcon,
      tone: "yellow",
    },
  ],
  emptyTitle: "Upcoming Evaluations",
  emptyStateTitle: "Nothing scheduled yet",
  emptyStateText: "Evaluations you pick and students confirm will appear here.",
  historyTitle: "History",
  ctaTitle: "READY TO EVALUATE?",
  ctaText: "Browse open requests for your projects and pick a time slot.",
  ctaLabel: "Open Requests",
  ctaTo: "/requests",
  actionSymbol: "→",
  actionAriaLabel: "Browse open requests",
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
  ctaTo: "/council/inbox",
  actionSymbol: "→",
  actionAriaLabel: "View council messages",
};

const dashboards: Record<AppRole, DashboardDefinition> = {
  STUDENT: studentDashboard,
  HITCHHIKER: hitchhikerDashboard,
  COUNCIL: councilDashboard,
};

// The student's request boxes, filled from the API (#507). They show skeletons during the first
// load, and only the error when it fails, never empty states that may not be true (#258).
function StudentRequestSections() {
  const { requests, isLoading, hasError } = useStudentRequests();

  if (hasError) {
    return (
      <p className="dashboard__load-error" role="alert">
        Could not load your requests. Please try again later.
      </p>
    );
  }

  return (
    <>
      <OpenRequests requests={requests} isLoading={isLoading} />
      <ScheduledEvaluations requests={requests} viewer="student" isLoading={isLoading} />
      <EvaluationHistory requests={requests} viewer="student" isLoading={isLoading} />
    </>
  );
}

// The Hitchhiker's boxes, filled from the API: the open queue and the picked requests (#61).
// Skeletons during the first load, only the error when it fails (#258).
function HitchhikerRequestSections() {
  const { openRequests, pickedRequests, isLoading, hasError } = useHitchhikerRequests();

  if (hasError) {
    return (
      <p className="dashboard__load-error" role="alert">
        Could not load your requests. Please try again later.
      </p>
    );
  }

  return (
    <>
      <OpenRequestQueue requests={openRequests} isLoading={isLoading} />
      <AwaitingConfirmation requests={pickedRequests} isLoading={isLoading} />
      <ScheduledEvaluations requests={pickedRequests} viewer="hitchhiker" isLoading={isLoading} />
      <EvaluationHistory requests={pickedRequests} viewer="hitchhiker" isLoading={isLoading} />
    </>
  );
}

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
        {activeRole === "STUDENT" && <StudentRequestSections />}
        {activeRole === "HITCHHIKER" && <HitchhikerRequestSections />}
        {activeRole === "COUNCIL" && (
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
        )}

        {activeRole === "COUNCIL" && (
          <section className="dashboard__section">
            <h2>{dashboard.historyTitle}</h2>

            <div className="dashboard-empty">
              <div className="dashboard-empty__history-mark">—</div>
              <h3>No history yet</h3>
              <p>Your recent activity will appear here.</p>
            </div>
          </section>
        )}
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
