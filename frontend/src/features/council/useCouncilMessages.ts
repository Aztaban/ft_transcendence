import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../../api/client";
import { listSCMessages } from "../../api/scMessages";
import type { SCMessage } from "../../types/scMessage";
import { useLiveRefresh } from "../../websocket/LiveProvider";

type LoadState = "loading" | "ready" | "error";

// "Show more" adds this many messages; one request returns at most MAX_PAGE_SIZE (api-plan §5.7).
const STEP = 20;
const MAX_PAGE_SIZE = 100;

interface Loaded {
  messages: SCMessage[];
  total: number;
  hasMore: boolean;
}

// The newest `limit` messages, always from the top of the list, so what is shown is one consistent
// list: a message that moves between pages meanwhile is never shown twice or skipped. Up to 100
// messages that is a single request; beyond, pages of 100 until `limit` is reached. DRF answers
// 404 for a page past the end: on a later page that means the list got shorter between two
// requests, so it starts again once. Any other failure, a 404 on the first page included, is a
// normal error.
async function loadNewest(
  unread: boolean,
  limit: number,
  signal: AbortSignal,
  isRetry = false,
): Promise<Loaded> {
  if (limit <= MAX_PAGE_SIZE) {
    const answer = await listSCMessages({ unread, pageSize: limit, signal });

    return { messages: answer.results, total: answer.count, hasMore: answer.next !== null };
  }

  const messages: SCMessage[] = [];
  let page = 1;
  let answer;

  do {
    try {
      answer = await listSCMessages({ unread, page, pageSize: MAX_PAGE_SIZE, signal });
    } catch (error) {
      if (page > 1 && !isRetry && error instanceof ApiError && error.status === 404) {
        return loadNewest(unread, limit, signal, true);
      }

      throw error;
    }

    // Between two pages the list can move, so a message is added once.
    messages.push(...answer.results.filter((item) => messages.every(({ id }) => id !== item.id)));
    page += 1;
  } while (answer.next !== null && messages.length < limit);

  return { messages, total: answer.count, hasMore: answer.next !== null };
}

// A council message list, newest first (api-plan §10.6): `unread` limits it to the new messages.
// Every load asks for the newest `limit` messages: "Show more" raises it by 20, and a refresh
// loads the same number again, so the user keeps their place. A new load cancels the one on its
// way, so an old answer never reaches the list, and a "Show more" still waiting is part of it.
// A new message notifies every council member, so the list refreshes then and after a reconnect.
// Read state changes by colleagues send no event: it also refreshes when the tab is shown again
// (§9.4). A failed refresh keeps what is shown. Another `unread` value loads the other list.
export function useCouncilMessages(unread: boolean) {
  const [loaded, setLoaded] = useState<Loaded>({ messages: [], total: 0, hasMore: false });
  const [loadState, setLoadState] = useState<LoadState>("loading");
  // How many messages are wanted, and how many the shown list was loaded for.
  const [limit, setLimit] = useState(STEP);
  const [shownLimit, setShownLimit] = useState(0);
  const [moreFailed, setMoreFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
    const controller = new AbortController();

    loadNewest(unread, limit, controller.signal)
      .then((answer) => {
        if (!controller.signal.aborted) {
          setLoaded(answer);
          setShownLimit(Math.max(limit, answer.messages.length));
          setMoreFailed(false);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setMoreFailed(limit > shownLimit && shownLimit > 0);
        setLoadState((current) => (current === "ready" ? current : "error"));
      });

    return () => {
      controller.abort();
    };
    // `shownLimit` is only read: it changes as the result of this effect.
  }, [unread, limit, reloadKey]);

  const showMore = useCallback(() => {
    setMoreFailed(false);

    if (limit > shownLimit) {
      // The last "Show more" failed: ask for the same messages again.
      refresh();
    } else {
      setLimit(shownLimit + STEP);
    }
  }, [limit, shownLimit, refresh]);

  return {
    messages: loaded.messages,
    total: loaded.total,
    hasMore: loaded.hasMore,
    isLoadingMore: loadState === "ready" && limit > shownLimit && !moreFailed,
    moreFailed,
    loadState,
    showMore,
  };
}
