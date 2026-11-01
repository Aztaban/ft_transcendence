import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { listSCMessages } from "../api/scMessages";
import AnonymousIcon from "../features/council/AnonymousIcon";
import ClockIcon from "../features/council/ClockIcon";
import CouncilTabs from "../features/council/CouncilTabs";
import type { SCMessage } from "../types/scMessage";
import { formatDate, formatTimeAgo } from "../utils/dateTime";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/council.css";

type LoadState = "loading" | "ready" | "error";

// Council "History" (#279): every message the council has received, read or not, newest first,
// from GET /sc-messages/ without a filter (api-plan §10.6). The contract has no "read only"
// filter, so the read state is shown on each card instead. Like the inbox, the list re-fetches in
// the background on `notification.created` (a new message), after a reconnect and when the tab is
// shown again, because read state changes by colleagues send no event (§9.4).
function CouncilHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SCMessage[]>([]);
  const [total, setTotal] = useState(0);

  // TODO: the list logic from here to `showMore` is a copy of CouncilInboxPage's, only without
  // `unread: true`. Move both into one shared hook once #677 (the inbox "Show more" fix) is merged.

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
    listSCMessages({ page: 1 })
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
  // list meanwhile wins: the old answer is dropped, or the pages in between would be skipped (#676).
  async function showMore() {
    const next = loadedPage + 1;
    const version = listVersion.current;

    setIsLoadingMore(true);
    setMoreFailed(false);

    try {
      const result = await listSCMessages({ page: next });

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
            <p className="council-error" role="alert">
              {t("council.loadMessagesError")}
            </p>
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

        <aside className="council-aside">
          <section className="council-panel">
            <h2>{t("council.historyAboutTitle")}</h2>
            <p>{t("council.historyAboutText")}</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default CouncilHistoryPage;
