import type { ReactNode } from "react";
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
import PixelBanner from "../features/home/PixelBanner";
import { useCouncilOverview } from "../features/home/useCouncilOverview";
import OpenRequests from "../features/student/OpenRequests";
import { useStudentRequests } from "../features/student/useStudentRequests";
import { useRole } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import { formatSlotStart } from "../utils/dateTime";
import "../styles/dashboard.css";

// A box of the overview row. `label` is a key of the "home" texts in src/i18n/locales.
interface OverviewItem {
  value: string;
  label: string;
  icon: string;
  tone: "teal" | "violet" | "blue" | "amber";
}

// The last row of the page. Texts are keys of the "home" texts in src/i18n/locales.
interface CallToAction {
  title: string;
  text: string;
  label: string;
  to: string;
  symbol: string;
}

const studentAction: CallToAction = {
  title: "home.ctaStudentTitle",
  text: "home.ctaStudentText",
  label: "home.ctaStudentLabel",
  to: "/requests",
  symbol: "+",
};

const hitchhikerAction: CallToAction = {
  title: "home.ctaHitchhikerTitle",
  text: "home.ctaHitchhikerText",
  label: "home.ctaHitchhikerLabel",
  to: "/requests",
  symbol: "→",
};

const councilAction: CallToAction = {
  title: "home.ctaCouncilTitle",
  text: "home.ctaCouncilText",
  label: "home.ctaCouncilLabel",
  to: "/council/inbox",
  symbol: "→",
};

// "—" until the number is known, and when it could not be loaded.
function countText(count: number, isKnown: boolean) {
  return isKnown ? String(count) : "—";
}

function isCompleted(request: EvaluationRequest) {
  return request.is_history && request.result !== null;
}

// The soonest confirmed evaluation that has not ended yet.
function nextEvaluation(requests: EvaluationRequest[]) {
  return requests
    .filter((request) => request.status === "confirmed" && !request.is_history && request.starts_at)
    .map((request) => request.starts_at as string)
    .sort()[0];
}

interface DashboardProps {
  subtitle: string;
  overview: OverviewItem[];
  action: CallToAction;
  children: ReactNode;
}

// The page of every workspace: banner, overview, the workspace's boxes and the call to action.
function Dashboard({ subtitle, overview, action, children }: DashboardProps) {
  const { t } = useTranslation();

  return (
    <section className="dashboard">
      <header className="dashboard-banner">
        <div className="dashboard-banner__text">
          <h1>{t("home.greeting")}</h1>
          <p>{t(subtitle)}</p>
        </div>

        <PixelBanner />
      </header>

      <div className="dashboard__content">
        <section className="dashboard-overview" aria-label={t("home.overview")}>
          {overview.map((item) => (
            <article
              className={`dashboard-overview__card dashboard-overview__card--${item.tone}`}
              key={item.label}
            >
              <img src={item.icon} alt="" aria-hidden="true" />

              <div>
                <strong>{item.value}</strong>
                <span>{t(item.label)}</span>
              </div>
            </article>
          ))}
        </section>

        <div className="dashboard__columns">{children}</div>
      </div>

      <section className="dashboard-cta">
        <div>
          <h2>{t(action.title)}</h2>
          <p>{t(action.text)}</p>
        </div>

        <Link className="dashboard-cta__button" to={action.to}>
          <span aria-hidden="true">{action.symbol}</span>
          {t(action.label)}
        </Link>
      </section>
    </section>
  );
}

// The student's boxes, filled from the API (#507). They show skeletons during the first load,
// and only the error when it fails, never empty states that may not be true (#258).
function StudentDashboard() {
  const { t } = useTranslation();
  const { requests, isLoading, hasError } = useStudentRequests();
  const isKnown = !isLoading && !hasError;
  const open = requests.filter(
    (request) => request.status === "pending" || request.status === "awaiting_confirmation",
  );
  const next = nextEvaluation(requests);

  const overview: OverviewItem[] = [
    {
      value: countText(open.length, isKnown),
      label: "home.pending",
      icon: pendingIcon,
      tone: "teal",
    },
    {
      value: countText(requests.filter(isCompleted).length, isKnown),
      label: "home.completed",
      icon: historyIcon,
      tone: "violet",
    },
    {
      value: next ? formatSlotStart(next) : isKnown ? t("home.notScheduled") : "—",
      label: "home.nextEvaluation",
      icon: requestIcon,
      tone: "blue",
    },
    {
      value: t("home.workspaceStudent"),
      label: "home.workspace",
      icon: hitchhikersIcon,
      tone: "amber",
    },
  ];

  return (
    <Dashboard subtitle="home.bannerStudent" overview={overview} action={studentAction}>
      {hasError ? (
        <p className="dashboard__load-error" role="alert">
          {t("myRequests.error")}
        </p>
      ) : (
        <>
          <OpenRequests requests={requests} isLoading={isLoading} />
          <ScheduledEvaluations requests={requests} viewer="student" isLoading={isLoading} />
          <EvaluationHistory requests={requests} viewer="student" isLoading={isLoading} />
        </>
      )}
    </Dashboard>
  );
}

// The Hitchhiker's boxes, filled from the API: the open queue and the picked requests (#61).
// Skeletons during the first load, only the error when it fails (#258).
function HitchhikerDashboard() {
  const { t } = useTranslation();
  const { openRequests, pickedRequests, isLoading, hasError } = useHitchhikerRequests();
  const isKnown = !isLoading && !hasError;
  const awaiting = pickedRequests.filter((request) => request.status === "awaiting_confirmation");

  const overview: OverviewItem[] = [
    {
      value: countText(openRequests.length, isKnown),
      label: "home.openRequests",
      icon: requestIcon,
      tone: "teal",
    },
    {
      value: countText(awaiting.length, isKnown),
      label: "home.awaitingConfirmation",
      icon: pendingIcon,
      tone: "amber",
    },
    {
      value: countText(pickedRequests.filter(isCompleted).length, isKnown),
      label: "home.evaluationsDone",
      icon: historyIcon,
      tone: "violet",
    },
    {
      value: t("home.workspaceHitchhiker"),
      label: "home.workspace",
      icon: hitchhikersIcon,
      tone: "blue",
    },
  ];

  return (
    <Dashboard subtitle="home.bannerHitchhiker" overview={overview} action={hitchhikerAction}>
      {hasError ? (
        <p className="dashboard__load-error" role="alert">
          {t("myRequests.error")}
        </p>
      ) : (
        <>
          <OpenRequestQueue requests={openRequests} isLoading={isLoading} />
          <AwaitingConfirmation requests={pickedRequests} isLoading={isLoading} />
          <ScheduledEvaluations
            requests={pickedRequests}
            viewer="hitchhiker"
            isLoading={isLoading}
          />
          <EvaluationHistory requests={pickedRequests} viewer="hitchhiker" isLoading={isLoading} />
        </>
      )}
    </Dashboard>
  );
}

// The Council's box: the newest messages nobody has read yet.
function CouncilDashboard() {
  const { t } = useTranslation();
  const { unread, unreadCount, totalCount, hitchhikerCount, isLoading, hasError } =
    useCouncilOverview();
  const isKnown = !isLoading && !hasError;

  const overview: OverviewItem[] = [
    {
      value: countText(unreadCount, isKnown),
      label: "home.newMessages",
      icon: requestIcon,
      tone: "teal",
    },
    {
      value: countText(totalCount - unreadCount, isKnown),
      label: "home.history",
      icon: historyIcon,
      tone: "violet",
    },
    {
      value: countText(hitchhikerCount, isKnown),
      label: "home.hitchhikers",
      icon: hitchhikersIcon,
      tone: "blue",
    },
    {
      value: t("home.workspaceCouncil"),
      label: "home.workspace",
      icon: pendingIcon,
      tone: "amber",
    },
  ];

  return (
    <Dashboard subtitle="home.bannerCouncil" overview={overview} action={councilAction}>
      {hasError ? (
        <p className="dashboard__load-error" role="alert">
          {t("council.loadMessagesError")}
        </p>
      ) : (
        <section
          className="dashboard__section dashboard__section--teal"
          aria-labelledby="council-messages-title"
        >
          <h2 id="council-messages-title">{t("home.messages")}</h2>

          {isLoading ? (
            <div className="dashboard-requests" aria-busy="true">
              <div className="dashboard-requests__skeleton" />
              <div className="dashboard-requests__skeleton" />
              <span className="dashboard-requests__sr-only">{t("council.loadingMessages")}</span>
            </div>
          ) : unread.length === 0 ? (
            <div className="dashboard-empty">
              <div className="dashboard-empty__history-mark" aria-hidden="true">
                —
              </div>
              <h3>{t("home.noMessages")}</h3>
              <p>{t("home.messagesText")}</p>
            </div>
          ) : (
            <div
              className="dashboard-requests"
              role="group"
              tabIndex={0}
              aria-labelledby="council-messages-title"
            >
              {unread.map((message) => (
                <article className="dashboard-request" key={message.id}>
                  <div className="dashboard-request__summary">
                    <h3>{t("council.messageNumber", { id: message.id })}</h3>
                    <p>{message.body}</p>
                  </div>

                  <Link
                    className="dashboard-request__review"
                    to={`/council/inbox/${message.id}`}
                    aria-label={t("council.readAria", { id: message.id })}
                  >
                    {t("council.read")} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </Dashboard>
  );
}

function HomePage() {
  const { activeRole } = useRole();

  if (activeRole === "HITCHHIKER") {
    return <HitchhikerDashboard />;
  }

  return activeRole === "COUNCIL" ? <CouncilDashboard /> : <StudentDashboard />;
}

export default HomePage;
