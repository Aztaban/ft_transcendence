import { useTranslation } from "react-i18next";
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

// Texts are keys of the "home" texts in src/i18n/locales; "—" is shown as it is.
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
  greeting: "home.greeting",
  overview: [
    {
      value: "—",
      label: "home.pending",
      icon: pendingIcon,
      tone: "turquoise",
    },
    {
      value: "—",
      label: "home.completed",
      icon: historyIcon,
      tone: "mint",
    },
    {
      value: "home.notScheduled",
      label: "home.nextEvaluation",
      icon: requestIcon,
      tone: "blue",
    },
    {
      value: "home.workspaceStudent",
      label: "home.workspace",
      icon: hitchhikersIcon,
      tone: "yellow",
    },
  ],
  emptyTitle: "home.upcoming",
  emptyStateTitle: "pending.emptyTitle",
  emptyStateText: "home.futureEvaluations",
  historyTitle: "home.history",
  ctaTitle: "home.ctaStudentTitle",
  ctaText: "home.ctaStudentText",
  ctaLabel: "home.ctaStudentLabel",
  ctaTo: "/requests",
  actionSymbol: "+",
  actionAriaLabel: "home.ctaStudentAria",
};

const hitchhikerDashboard: DashboardDefinition = {
  greeting: "home.greeting",
  overview: [
    {
      value: "—",
      label: "home.openRequests",
      icon: requestIcon,
      tone: "turquoise",
    },
    {
      value: "—",
      label: "home.awaitingConfirmation",
      icon: pendingIcon,
      tone: "blue",
    },
    {
      value: "—",
      label: "home.evaluationsDone",
      icon: historyIcon,
      tone: "mint",
    },
    {
      value: "home.workspaceHitchhiker",
      label: "home.workspace",
      icon: hitchhikersIcon,
      tone: "yellow",
    },
  ],
  emptyTitle: "home.upcoming",
  emptyStateTitle: "pending.emptyTitle",
  emptyStateText: "home.pickedEvaluations",
  historyTitle: "home.history",
  ctaTitle: "home.ctaHitchhikerTitle",
  ctaText: "home.ctaHitchhikerText",
  ctaLabel: "home.ctaHitchhikerLabel",
  ctaTo: "/requests",
  actionSymbol: "→",
  actionAriaLabel: "home.ctaHitchhikerAria",
};

const councilDashboard: DashboardDefinition = {
  greeting: "home.greeting",
  overview: [
    {
      value: "—",
      label: "home.newMessages",
      icon: requestIcon,
      tone: "turquoise",
    },
    {
      value: "—",
      label: "home.history",
      icon: historyIcon,
      tone: "mint",
    },
    {
      value: "—",
      label: "home.hitchhikers",
      icon: hitchhikersIcon,
      tone: "blue",
    },
    {
      value: "home.workspaceCouncil",
      label: "home.workspace",
      icon: pendingIcon,
      tone: "yellow",
    },
  ],
  emptyTitle: "home.messages",
  emptyStateTitle: "home.noMessages",
  emptyStateText: "home.messagesText",
  historyTitle: "home.history",
  ctaTitle: "home.ctaCouncilTitle",
  ctaText: "home.ctaCouncilText",
  ctaLabel: "home.ctaCouncilLabel",
  ctaTo: "/council/inbox",
  actionSymbol: "→",
  actionAriaLabel: "home.ctaCouncilAria",
};

const dashboards: Record<AppRole, DashboardDefinition> = {
  STUDENT: studentDashboard,
  HITCHHIKER: hitchhikerDashboard,
  COUNCIL: councilDashboard,
};

// The student's request boxes, filled from the API (#507). They show skeletons during the first
// load, and only the error when it fails, never empty states that may not be true (#258).
function StudentRequestSections() {
  const { t } = useTranslation();
  const { requests, isLoading, hasError } = useStudentRequests();

  if (hasError) {
    return (
      <p className="dashboard__load-error" role="alert">
        {t("myRequests.error")}
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
  const { t } = useTranslation();
  const { openRequests, pickedRequests, isLoading, hasError } = useHitchhikerRequests();

  if (hasError) {
    return (
      <p className="dashboard__load-error" role="alert">
        {t("myRequests.error")}
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
  const { t } = useTranslation();
  const { activeRole } = useRole();
  const dashboard = dashboards[activeRole];

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <h1>{t(dashboard.greeting)}</h1>
      </header>

      <section className="dashboard__section dashboard__overview-section">
        <div className="dashboard__section-heading">
          <h2>{t("home.overview")}</h2>
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

              <strong>{item.value === "—" ? item.value : t(item.value)}</strong>
              <span>{t(item.label)}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard__columns">
        {activeRole === "STUDENT" && <StudentRequestSections />}
        {activeRole === "HITCHHIKER" && <HitchhikerRequestSections />}
        {activeRole === "COUNCIL" && (
          <section className="dashboard__section">
            <h2>{t(dashboard.emptyTitle)}</h2>

            <div className="dashboard-empty">
              <Link
                className="dashboard-empty__add"
                to={dashboard.ctaTo}
                aria-label={t(dashboard.actionAriaLabel)}
              >
                {dashboard.actionSymbol}
              </Link>
              <h3>{t(dashboard.emptyStateTitle)}</h3>
              <p>{t(dashboard.emptyStateText)}</p>
            </div>
          </section>
        )}

        {activeRole === "COUNCIL" && (
          <section className="dashboard__section">
            <h2>{t(dashboard.historyTitle)}</h2>

            <div className="dashboard-empty">
              <div className="dashboard-empty__history-mark">—</div>
              <h3>{t("home.noHistory")}</h3>
              <p>{t("home.activityText")}</p>
            </div>
          </section>
        )}
      </div>

      <section className="dashboard-cta">
        <div>
          <h2>{t(dashboard.ctaTitle)}</h2>
          <p>{t(dashboard.ctaText)}</p>
        </div>

        <Link className="dashboard-cta__button" to={dashboard.ctaTo}>
          <span>{dashboard.actionSymbol}</span>
          {t(dashboard.ctaLabel)}
        </Link>
      </section>
    </section>
  );
}

export default HomePage;
