import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import usePageTitle from "../components/layout/usePageTitle";
import LoadError from "../components/ui/LoadError";
import AnonymousIcon from "../features/council/AnonymousIcon";
import ClockIcon from "../features/council/ClockIcon";
import CouncilTabs from "../features/council/CouncilTabs";
import { useCouncilMessages } from "../features/council/useCouncilMessages";
import { formatDate, formatTimeAgo } from "../utils/dateTime";
import "../styles/council.css";

// Council "History" (#279): the messages the council has received, read or not, newest first,
// from GET /sc-messages/ without a filter (api-plan §10.6). The contract has no "read only"
// filter, so the read state is shown on each card instead. The list, "Show more" and the live
// refresh are the inbox's (`useCouncilMessages`); a refresh keeps the messages already loaded
// (§5.7, §9.4). A message opened from here goes back to the History.
function CouncilHistoryPage() {
  const { t } = useTranslation();
  usePageTitle(t("council.historyTitle"));
  const navigate = useNavigate();
  const { messages, total, hasMore, isLoadingMore, moreFailed, loadState, showMore, retry } =
    useCouncilMessages(false);

  const now = new Date();

  return (
    <section className="council-inbox">
      <header className="council-header council-header--back">
        <button
          className="council-back"
          type="button"
          aria-label={t("council.backHome")}
          onClick={() => navigate("/")}
        >
          ‹
        </button>
        <div>
          <h1>
            {t("council.historyTitle")}
            {loadState === "ready" && total > 0 && (
              <span className="council-count">{t("council.historyCount", { count: total })}</span>
            )}
          </h1>
          <p className="council-subtitle">{t("council.historySubtitle")}</p>
        </div>
      </header>

      <CouncilTabs active="history" />

      <div className="council-layout">
        <div className="council-message__body">
          {loadState === "loading" && (
            <div className="council-list" aria-busy="true">
              {[1, 2, 3].map((placeholder) => (
                <div className="council-skeleton" key={placeholder} />
              ))}
              <span className="council-sr-only">{t("council.loadingMessages")}</span>
            </div>
          )}

          {loadState === "error" && (
            <LoadError className="council-error" onRetry={retry}>
              {t("council.loadMessagesError")}
            </LoadError>
          )}

          {loadState === "ready" && messages.length === 0 && (
            <div className="council-empty">
              <h2>{t("council.historyEmpty")}</h2>
              <p>{t("council.historyEmptyText")}</p>
            </div>
          )}

          {loadState === "ready" && messages.length > 0 && (
            <>
              <ul className="council-list" aria-label={t("council.historyListAria")}>
                {messages.map((message, index) => (
                  <li
                    className="council-item"
                    key={message.id}
                    style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                  >
                    <span className="council-item__icon">
                      <AnonymousIcon />
                      {message.read_at === null && (
                        <span className="council-item__dot" aria-hidden="true" />
                      )}
                    </span>
                    <div className="council-item__content">
                      <div className="council-item__head">
                        <h2>{t("council.messageNumber", { id: message.id })}</h2>
                        {message.read_at === null ? (
                          <span className="council-pill">{t("council.unread")}</span>
                        ) : (
                          <span className="council-pill council-pill--muted">
                            {t("council.readOn", { date: formatDate(message.read_at) })}
                          </span>
                        )}
                        <span className="council-item__time">
                          <ClockIcon />
                          {t("council.received", { time: formatTimeAgo(message.created_at, now) })}
                        </span>
                      </div>
                      <p className="council-item__preview">{message.body}</p>
                    </div>
                    <Link
                      className="council-button council-button--small"
                      to={`/council/inbox/${message.id}`}
                      state={{ from: "/council/history" }}
                      aria-label={t("council.openAria", { id: message.id })}
                    >
                      {t("council.open")} <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>

              {moreFailed && (
                <p className="council-error" role="alert">
                  {t("council.loadMoreError")}
                </p>
              )}

              {hasMore && (
                <div className="council-actions council-actions--center">
                  <button
                    className="council-more"
                    type="button"
                    disabled={isLoadingMore}
                    onClick={showMore}
                  >
                    {isLoadingMore
                      ? t("council.loadingMore")
                      : t("council.showMore", { count: total - messages.length })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="council-aside">
          <section className="council-panel">
            <h2>{t("council.historyAboutTitle")}</h2>
            <p>{t("council.historyAboutText")}</p>
          </section>
        </div>
      </div>
    </section>
  );
}

export default CouncilHistoryPage;
