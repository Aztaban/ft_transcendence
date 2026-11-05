import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { ListEvaluationRequestsParams } from "../api/evaluationRequests";
import historyIcon from "../assets/figma/history.svg";
import hitchhikersIcon from "../assets/figma/hitchhikers.svg";
import pendingIcon from "../assets/figma/pending.svg";
import requestIcon from "../assets/figma/request.svg";
import usePageTitle from "../components/layout/usePageTitle";
import AwaitingConfirmation from "../features/hitchhiker/AwaitingConfirmation";
import EvaluationHistory from "../features/hitchhiker/EvaluationHistory";
import OpenRequestQueue from "../features/hitchhiker/OpenRequestQueue";
import ScheduledEvaluations from "../features/hitchhiker/ScheduledEvaluations";
import { useHitchhikerRequests } from "../features/hitchhiker/useHitchhikerRequests";
import PixelBanner from "../features/home/PixelBanner";
import ScrollableList from "../features/home/ScrollableList";
import { useCouncilOverview } from "../features/home/useCouncilOverview";
import { useRequestOverview } from "../features/home/useRequestOverview";
import OpenRequests from "../features/student/OpenRequests";
import { useStudentRequests } from "../features/student/useStudentRequests";
import { useRole, type AppRole } from "../store/RoleContext";
import { formatSlotStart } from "../utils/dateTime";
import { EVALUATION_EVENTS, OPEN_QUEUE_EVENTS } from "../websocket/events";
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

// Filtered lists whose `count` gives the real totals (api-plan §10.4), and the student's soonest
// evaluations. Kept here so that they stay the same object between renders.
const studentQueries = {
  open: { scope: "mine", status: ["pending", "awaiting_confirmation"], history: false },
  completed: { scope: "mine", status: ["confirmed"], history: true },
  upcoming: { scope: "mine", status: ["confirmed"], history: false, ordering: "starts_at" },
} satisfies Record<string, ListEvaluationRequestsParams>;

const hitchhikerQueries = {
  open: { scope: "open" },
  awaiting: { scope: "picked", status: ["awaiting_confirmation"] },
  done: { scope: "picked", status: ["confirmed"], history: true },
} satisfies Record<string, ListEvaluationRequestsParams>;

const subtitles: Record<AppRole, string> = {
  STUDENT: "home.bannerStudent",
  HITCHHIKER: "home.bannerHitchhiker",
  COUNCIL: "home.bannerCouncil",
};

// "—" until the number is known, and when it could not be loaded.
function countText(count: number | null | undefined) {
  return count === null || count === undefined ? "—" : String(count);
}

const MINUTE = 60 * 1000;

// The time, once a minute: no event fires when an evaluation ends.
function useCurrentMinute() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE);

    return () => window.clearInterval(timer);
  }, []);

  return now;
}

interface DashboardProps {
  overview: OverviewItem[];
  action: CallToAction;
  children: ReactNode;
}

// What every workspace shows under the banner: the overview, its boxes and the call to action.
function Dashboard({ overview, action, children }: DashboardProps) {
  const { t } = useTranslation();

  return (
    <>
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
    </>
  );
}

// The student's boxes, filled from the API (#507). They show skeletons during the first load,
// and only the error when it fails, never empty states that may not be true (#258).
function StudentDashboard() {
  const { t } = useTranslation();
  const { requests, isLoading, hasError } = useStudentRequests();
  const counts = useRequestOverview(studentQueries, EVALUATION_EVENTS);
  const now = useCurrentMinute();
  const next = counts.upcoming?.results.find(
    (request) => request.ends_at !== null && Date.parse(request.ends_at) > now,
  );
  const nextText = next?.starts_at
    ? formatSlotStart(next.starts_at)
    : counts.upcoming
      ? t("home.notScheduled")
      : "—";

  const overview: OverviewItem[] = [
    {
      value: countText(counts.open?.count),
      label: "home.openRequests",
      icon: pendingIcon,
      tone: "teal",
    },
    {
      value: countText(counts.completed?.count),
      label: "home.completed",
      icon: historyIcon,
      tone: "violet",
    },
    {
      value: nextText,
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
    <Dashboard overview={overview} action={studentAction}>
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
  const counts = useRequestOverview(hitchhikerQueries, OPEN_QUEUE_EVENTS);

  const overview: OverviewItem[] = [
    {
      value: countText(counts.open?.count),
      label: "home.openRequests",
      icon: requestIcon,
      tone: "teal",
    },
    {
      value: countText(counts.awaiting?.count),
      label: "home.awaitingConfirmation",
      icon: pendingIcon,
      tone: "amber",
    },
    {
      value: countText(counts.done?.count),
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
    <Dashboard overview={overview} action={hitchhikerAction}>
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
      value: countText(isKnown ? unreadCount : null),
      label: "home.newMessages",
      icon: requestIcon,
      tone: "teal",
    },
    {
      value: countText(isKnown ? totalCount : null),
      label: "home.history",
      icon: historyIcon,
      tone: "violet",
    },
    {
      value: countText(hitchhikerCount),
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
    <Dashboard overview={overview} action={councilAction}>
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
              <h3>{t(totalCount > 0 ? "council.caughtUp" : "home.noMessages")}</h3>
              <p>{t(totalCount > 0 ? "council.caughtUpText" : "home.messagesText")}</p>
            </div>
          ) : (
            <ScrollableList labelledBy="council-messages-title">
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
            </ScrollableList>
          )}
        </section>
      )}
    </Dashboard>
  );
}

function WorkspaceDashboard({ role }: { role: AppRole }) {
  if (role === "HITCHHIKER") {
    return <HitchhikerDashboard />;
  }

  return role === "COUNCIL" ? <CouncilDashboard /> : <StudentDashboard />;
}

function HomePage() {
  const { t } = useTranslation();

  usePageTitle(t("nav.home"));
  const { activeRole } = useRole();

  return (
    <section className="dashboard">
      <header className="dashboard-banner">
        <div className="dashboard-banner__text">
          <h1>{t("home.greeting")}</h1>
          <p>{t(subtitles[activeRole])}</p>
        </div>

        <PixelBanner />
      </header>

      <WorkspaceDashboard role={activeRole} />
    </section>
  );
}

export default HomePage;
