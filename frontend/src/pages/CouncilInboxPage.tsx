import { useEffect, useRef, useState } from "react";
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
const howItWorks = [
  { title: "Read the message", text: "Opening it does not mark it as read." },
  { title: "Mark it as read", text: "It moves to the History for every council member." },
  { title: "Keep a note", text: "Coordinate in the shared note. The sender never sees it." },
];

// Council "Messages" (#277, Figma "new messages"): messages no council member has read yet,
// newest first, from GET /sc-messages/?unread=true (api-plan §10.6). Messages have no title,
// so a card shows its number and the first lines of the text. A new message notifies every
// council member (`notification.created`, §9.3), so the list re-fetches in the background then
// and after a reconnect.
function CouncilInboxPage() {
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

  useLiveRefresh(["notification.created"], () => {
    isLiveRefresh.current = true;
    setPage(1);
    setReloadKey((key) => key + 1);
  });

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
          aria-label="Back to home"
          onClick={() => navigate("/")}
        >
          ‹
        </button>
        <div>
          <h1>
            Messages
            {loadState === "ready" && total > 0 && (
              <span className="council-count">{total} new</span>
            )}
          </h1>
          <p className="council-subtitle">New anonymous messages from your peers.</p>
        </div>
      </header>

      <nav className="council-tabs" aria-label="Council messages">
        <span className="council-tabs__tab council-tabs__tab--active" aria-current="page">
          New
        </span>
        <Link className="council-tabs__tab" to="/council/history">
          History
        </Link>
      </nav>

      <div className="council-layout">
        <div className="council-message__body">
          {loadState === "loading" && (
            <div className="council-list" aria-busy="true">
              {[1, 2, 3].map((placeholder) => (
                <div className="council-skeleton" key={placeholder} />
              ))}
              <span className="council-sr-only">Loading messages…</span>
            </div>
          )}

          {loadState === "error" && (
            <p className="council-error" role="alert">
              Could not load the messages. Please try again later.
            </p>
          )}

          {loadState === "ready" && messages.length === 0 && (
            <div className="council-empty">
              <span className="council-empty__icon" aria-hidden="true">
                ✓
              </span>
              <h2>All caught up!</h2>
              <p>There are no new messages. The ones you have read are in the History.</p>
              <Link className="council-button council-button--small" to="/council/history">
                Open History <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}

          {loadState === "ready" && messages.length > 0 && (
            <>
              <ul className="council-list" aria-label="New messages">
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
                        <h2>Message #{message.id}</h2>
                        {now.getTime() - new Date(message.created_at).getTime() < DAY && (
                          <span className="council-pill">New</span>
                        )}
                        <span className="council-item__time">
                          <ClockIcon />
                          Received {formatTimeAgo(message.created_at, now)}
                        </span>
                      </div>
                      <p className="council-item__preview">{message.body}</p>
                    </div>
                    <Link
                      className="council-button council-button--small"
                      to={`/council/inbox/${message.id}`}
                      aria-label={`Read message #${message.id}`}
                    >
                      Read <span aria-hidden="true">→</span>
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
                    {isLoadingMore ? "Loading…" : `Show more (${total - messages.length} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="council-aside">
          <section className="council-panel">
            <h2>How the inbox works</h2>
            <ol className="council-steps">
              {howItWorks.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="council-panel council-panel--tip">
            <h2>Tip</h2>
            <p>Messages are anonymous: nobody in the council can see who wrote them.</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default CouncilInboxPage;
