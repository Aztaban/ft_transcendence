import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { listSCMessages } from "../api/scMessages";
import AnonymousIcon from "../features/council/AnonymousIcon";
import ClockIcon from "../features/council/ClockIcon";
import type { SCMessage } from "../types/scMessage";
import { formatTimeAgo } from "../utils/dateTime";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/council.css";

type LoadState = "loading" | "ready" | "error";

const DAY = 24 * 60 * 60 * 1000;

// What council members do with a message (api-plan §7.3, §10.6).
// The texts are "council.how<Step>Title" and "council.how<Step>Text".
const howItWorks = ["Open", "Mark", "Note"];

// Council "Messages" (#277, Figma "new messages"): messages no council member has read yet,
// newest first, from GET /sc-messages/?unread=true (api-plan §10.6). Messages have no title,
// so a card shows its number and the first lines of the text. A new message notifies every
// council member (`notification.created`, §9.3), so the list re-fetches in the background then
// and after a reconnect.
function CouncilInboxPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SCMessage[]>([]);
  const [total, setTotal] = useState(0);
  // The last page that is actually shown; "Show more" loads the one after it (§5.7).
  const [loadedPage, setLoadedPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  // Set by a live refresh: a failure then keeps the messages already shown.
  const isLiveRefresh = useRef(false);
  // Counts the times the list was replaced, so "Show more" can drop a page asked for before that.
  const listVersion = useRef(0);

  // Reloads the first page in the background, keeping what is shown if that fails.
  const refreshInBackground = useCallback(() => {
    isLiveRefresh.current = true;
    setReloadKey((key) => key + 1);
  }, []);

  useLiveRefresh(["notification.created"], refreshInBackground);

  // Read state changes by colleagues send no event: catch up when the tab is shown again (§9.3).
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshInBackground();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshInBackground]);

  useEffect(() => {
    let active = true;
    const inBackground = isLiveRefresh.current;

    isLiveRefresh.current = false;

    // Always the first page: a refresh replaces the list, and only a successful answer does, so
    // a failed background refresh keeps the shown list and its page count together.
    listSCMessages({ unread: true, page: 1 })
      .then((result) => {
        if (active) {
          listVersion.current += 1;
          setMessages(result.results);
          setLoadedPage(1);
          setTotal(result.count);
          setHasMore(result.next !== null);
          setMoreFailed(false);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setLoadState((current) => (inBackground && current === "ready" ? current : "error"));
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // The page after the last one shown. The page count moves on only when it arrived; a failure
  // shows an error and the next click asks for the same page again. A refresh that replaced the
  // list meanwhile wins: the old answer is dropped, or the pages in between would be skipped.
  async function showMore() {
    const next = loadedPage + 1;
    const version = listVersion.current;

    setIsLoadingMore(true);
    setMoreFailed(false);

    try {
      const result = await listSCMessages({ unread: true, page: next });

      if (version !== listVersion.current) {
        return;
      }

      // A message that moved between pages (new ones arrive on top) is not shown twice.
      setMessages((current) => [
        ...current,
        ...result.results.filter((message) => current.every((shown) => shown.id !== message.id)),
      ]);
      setLoadedPage(next);
      setTotal(result.count);
      setHasMore(result.next !== null);
    } catch {
      setMoreFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

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
