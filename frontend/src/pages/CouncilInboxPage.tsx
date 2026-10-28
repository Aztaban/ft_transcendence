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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  // Set by a live refresh: a failure then keeps the messages already shown.
  const isLiveRefresh = useRef(false);

  // Reloads the first page in the background, keeping what is shown if that fails.
  const refreshInBackground = useCallback(() => {
    isLiveRefresh.current = true;
    setPage(1);
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

    listSCMessages({ unread: true, page })
      .then((result) => {
        if (active) {
          setMessages((current) => (page === 1 ? result.results : [...current, ...result.results]));
          setTotal(result.count);
          setHasMore(result.next !== null);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active && page === 1) {
          setLoadState((current) => (inBackground && current === "ready" ? current : "error"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingMore(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, reloadKey]);

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

              {hasMore && (
                <div className="council-actions council-actions--center">
                  <button
                    className="council-more"
                    type="button"
                    disabled={isLoadingMore}
                    onClick={() => {
                      setIsLoadingMore(true);
                      setPage((current) => current + 1);
                    }}
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
