import { useCallback, useEffect, useRef, useState } from "react";

import { listSCMessages } from "../../api/scMessages";
import type { SCMessage } from "../../types/scMessage";
import { useLiveRefresh } from "../../websocket/LiveProvider";

type LoadState = "loading" | "ready" | "error";

// Loads pages `first` to `last`, stopping early when the list has become shorter (§5.7: a page
// past the end would be a 404).
async function loadPages(unread: boolean, first: number, last: number, signal: AbortSignal) {
  const results: SCMessage[] = [];

  for (let page = first; ; page += 1) {
    const answer = await listSCMessages({ unread, page, signal });

    results.push(...answer.results);

    if (page >= last || answer.next === null) {
      return { results, count: answer.count, hasMore: answer.next !== null, lastPage: page };
    }
  }
}

// A council message list, newest first (api-plan §10.6): `unread` limits it to the new messages.
// "Show more" asks for one more page. A refresh reloads every page the user has asked for, so
// they keep their place; it cancels a request still on its way, and a page asked for by then is
// part of the refresh. Only one request is ever running, so an old answer cannot reach the list.
// A new message notifies every council member, so the list refreshes then and after a reconnect.
// Read state changes by colleagues send no event: it also refreshes when the tab is shown again
// (§9.4). A failed refresh keeps what is shown.
export function useCouncilMessages(unread: boolean) {
  const [messages, setMessages] = useState<SCMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [shownPages, setShownPages] = useState(0);
  const [wantedPages, setWantedPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const shownPagesNow = useRef(0);
  const finishedReload = useRef(-1);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useLiveRefresh(["notification.created"], refresh);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    const isRefresh = finishedReload.current !== reloadKey;

    if (!isRefresh && wantedPages <= shownPagesNow.current) {
      return;
    }

    const controller = new AbortController();
    const firstPage = isRefresh ? 1 : wantedPages;

    loadPages(unread, firstPage, wantedPages, controller.signal)
      .then((answer) => {
        if (controller.signal.aborted) {
          return;
        }

        finishedReload.current = reloadKey;
        shownPagesNow.current = answer.lastPage;
        setMessages((current) =>
          isRefresh
            ? answer.results
            : // A message that moved between pages (new ones arrive on top) is not shown twice.
              [
                ...current,
                ...answer.results.filter((message) =>
                  current.every((shown) => shown.id !== message.id),
                ),
              ],
        );
        setShownPages(answer.lastPage);
        setWantedPages(answer.lastPage);
        setTotal(answer.count);
        setHasMore(answer.hasMore);
        setMoreFailed(false);
        setLoadState("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        finishedReload.current = reloadKey;
        setMoreFailed(wantedPages > shownPagesNow.current && shownPagesNow.current > 0);
        setWantedPages(Math.max(shownPagesNow.current, 1));
        setLoadState((current) => (current === "ready" ? current : "error"));
      });

    return () => {
      controller.abort();
    };
  }, [unread, wantedPages, reloadKey]);

  const showMore = useCallback(() => {
    setMoreFailed(false);
    setWantedPages(shownPagesNow.current + 1);
  }, []);

  return {
    messages,
    total,
    hasMore,
    isLoadingMore: loadState === "ready" && wantedPages > shownPages,
    moreFailed,
    loadState,
    showMore,
  };
}
