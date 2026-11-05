import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import usePageTitle from "../components/layout/usePageTitle";
import AnonymousIcon from "../features/council/AnonymousIcon";
import ClockIcon from "../features/council/ClockIcon";
import CouncilTabs from "../features/council/CouncilTabs";
import { useCouncilMessages } from "../features/council/useCouncilMessages";
import { formatTimeAgo } from "../utils/dateTime";
import "../styles/council.css";

const DAY = 24 * 60 * 60 * 1000;

// What council members do with a message (api-plan §7.3, §10.6).
// The texts are "council.how<Step>Title" and "council.how<Step>Text".
const howItWorks = ["Open", "Mark", "Note"];

// Council "Messages" (#277, Figma "new messages"): messages no council member has read yet,
// newest first, from GET /sc-messages/?unread=true (api-plan §10.6). Messages have no title,
// so a card shows its number and the first lines of the text.
function CouncilInboxPage() {
  const { t } = useTranslation();
  usePageTitle(t("council.messages"));
  const navigate = useNavigate();
  const { messages, total, hasMore, isLoadingMore, moreFailed, loadState, showMore } =
    useCouncilMessages(true);

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
            {t("council.messages")}
            {loadState === "ready" && total > 0 && (
              <span className="council-count">{t("council.newCount", { count: total })}</span>
            )}
          </h1>
          <p className="council-subtitle">{t("council.inboxSubtitle")}</p>
        </div>
      </header>

      <CouncilTabs active="new" />

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
            <p className="council-error" role="alert">
              {t("council.loadMessagesError")}
            </p>
          )}

          {loadState === "ready" && messages.length === 0 && (
            <div className="council-empty">
              <span className="council-empty__icon" aria-hidden="true">
                ✓
              </span>
              <h2>{t("council.caughtUp")}</h2>
              <p>{t("council.caughtUpText")}</p>
              <Link className="council-button council-button--small" to="/council/history">
                {t("council.openHistory")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}

          {loadState === "ready" && messages.length > 0 && (
            <>
              <ul className="council-list" aria-label={t("council.newListAria")}>
                {messages.map((message, index) => (
                  <li
                    className="council-item"
                    key={message.id}
                    style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                  >
                    <span className="council-item__icon">
                      <AnonymousIcon />
                      <span className="council-item__dot" aria-hidden="true" />
                    </span>
                    <div className="council-item__content">
                      <div className="council-item__head">
                        <h2>{t("council.messageNumber", { id: message.id })}</h2>
                        {now.getTime() - new Date(message.created_at).getTime() < DAY && (
                          <span className="council-pill">{t("council.newPill")}</span>
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
                      aria-label={t("council.readAria", { id: message.id })}
                    >
                      {t("council.read")} <span aria-hidden="true">→</span>
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

        <aside className="council-aside">
          <section className="council-panel">
            <h2>{t("council.inboxHowTitle")}</h2>
            <ol className="council-steps">
              {howItWorks.map((item) => (
                <li key={item}>
                  <strong>{t(`council.how${item}Title`)}</strong>
                  <span>{t(`council.how${item}Text`)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="council-panel council-panel--tip">
            <h2>{t("council.tip")}</h2>
            <p>{t("council.inboxTip")}</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default CouncilInboxPage;
