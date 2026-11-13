import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";

import type { ListEvaluationRequestsParams } from "../api/evaluationRequests";
import usePageTitle from "../components/layout/usePageTitle";
import Icon, { type IconName } from "../components/ui/Icon";
import LoadError from "../components/ui/LoadError";
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
import { useCurrentUser } from "../store/CurrentUserContext";
import { useRole, workspacesFor, type AppRole } from "../store/RoleContext";
import { formatSlotStart } from "../utils/dateTime";
import { EVALUATION_EVENTS, OPEN_QUEUE_EVENTS } from "../websocket/events";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import "../styles/dashboard.css";

// A box of the overview row. `label` is a key of the "home" texts in src/i18n/locales.
interface OverviewItem {
  value: string;
  label: string;
  icon: IconName;
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

// The open queue's count comes with the queue itself (`useHitchhikerRequests`).
const hitchhikerQueries = {
  awaiting: { scope: "picked", status: ["awaiting_confirmation"] },
  done: { scope: "picked", status: ["confirmed"], history: true },
} satisfies Record<string, ListEvaluationRequestsParams>;

// No Administration banner: HomePage sends that workspace to Users before it is shown.
const subtitles: Record<Exclude<AppRole, "ADMIN">, string> = {
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
              <Icon name={item.icon} />

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
  const { requests, isLoading, hasError, retry } = useStudentRequests();
  // Every account is a student: the numbers need no role, so they do not wait for /users/me/.
  const counts = useRequestOverview(studentQueries, EVALUATION_EVENTS, true);
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
      icon: "pending",
      tone: "teal",
    },
    {
      value: countText(counts.completed?.count),
      label: "home.completed",
      icon: "history",
      tone: "violet",
    },
    {
      value: nextText,
      label: "home.nextEvaluation",
      icon: "request",
      tone: "blue",
    },
    {
      value: t("home.workspaceStudent"),
      label: "home.workspace",
      icon: "hitchhikers",
      tone: "amber",
    },
  ];

  return (
    <Dashboard overview={overview} action={studentAction}>
      {hasError ? (
        <LoadError className="dashboard__load-error" onRetry={retry}>
          {t("myRequests.error")}
        </LoadError>
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
  // Both wait until /users/me/ confirms the role of the restored workspace, so no 403s.
  const { roles, isLoaded, loadFailed, refresh } = useCurrentUser();
  const enabled = isLoaded && workspacesFor(roles).includes("HITCHHIKER");
  const { openRequests, openCount, pickedRequests, isLoading, hasError, retry } =
    useHitchhikerRequests(enabled);
  const counts = useRequestOverview(hitchhikerQueries, OPEN_QUEUE_EVENTS, enabled);

  const overview: OverviewItem[] = [
    {
      value: countText(openCount),
      label: "home.openRequests",
      icon: "request",
      tone: "teal",
    },
    {
      value: countText(counts.awaiting?.count),
      label: "home.awaitingConfirmation",
      icon: "pending",
      tone: "amber",
    },
    {
      value: countText(counts.done?.count),
      label: "home.evaluationsDone",
      icon: "history",
      tone: "violet",
    },
    {
      value: t("home.workspaceHitchhiker"),
      label: "home.workspace",
      icon: "hitchhikers",
      tone: "blue",
    },
  ];

  return (
    <Dashboard overview={overview} action={hitchhikerAction}>
      {!isLoaded && loadFailed ? (
        // Without the roles nothing is asked: say so instead of placeholders forever (#371).
        <LoadError className="dashboard__load-error" onRetry={refresh}>
          {t("common.userLoadError")}
        </LoadError>
      ) : hasError ? (
        <LoadError className="dashboard__load-error" onRetry={retry}>
          {t("myRequests.error")}
        </LoadError>
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
  const { isLoaded, loadFailed, refresh } = useCurrentUser();
  const { unread, unreadCount, totalCount, hitchhikerCount, isLoading, hasError, retry } =
    useCouncilOverview();
  const isKnown = !isLoading && !hasError;

  const overview: OverviewItem[] = [
    {
      value: countText(isKnown ? unreadCount : null),
      label: "home.newMessages",
      icon: "request",
      tone: "teal",
    },
    {
      value: countText(isKnown ? totalCount : null),
      label: "home.history",
      icon: "history",
      tone: "violet",
    },
    {
      value: countText(hitchhikerCount),
      label: "home.hitchhikers",
      icon: "hitchhikers",
      tone: "blue",
    },
    {
      value: t("home.workspaceCouncil"),
      label: "home.workspace",
      icon: "pending",
      tone: "amber",
    },
  ];

  return (
    <Dashboard overview={overview} action={councilAction}>
      {!isLoaded && loadFailed ? (
        // Without the roles nothing is asked: say so instead of placeholders forever (#371).
        <LoadError className="dashboard__load-error" onRetry={refresh}>
          {t("common.userLoadError")}
        </LoadError>
      ) : hasError ? (
        <LoadError className="dashboard__load-error" onRetry={retry}>
          {t("council.loadMessagesError")}
        </LoadError>
      ) : (
        <section
          className="dashboard__section dashboard__section--teal"
          aria-labelledby="council-messages-title"
        >
          <h2 id="council-messages-title">{t("home.messages")}</h2>

          {isLoading ? (
            <Skeleton
              className="dashboard-requests"
              itemClassName="dashboard-requests__skeleton"
              label={t("council.loadingMessages")}
            />
          ) : unread.length === 0 ? (
            <EmptyState
              className="dashboard-empty"
              iconClassName="dashboard-empty__history-mark"
              icon="—"
              title={t(totalCount > 0 ? "council.caughtUp" : "home.noMessages")}
              text={t(totalCount > 0 ? "council.caughtUpText" : "home.messagesText")}
            />
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

  // The Administration workspace has no Home of its own and opens on Users. `replace` keeps the
  // Back button from returning here and being sent forward again.
  if (activeRole === "ADMIN") {
    return <Navigate to="/manage/users" replace />;
  }

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
