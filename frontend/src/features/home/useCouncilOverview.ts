import { useCallback, useEffect, useRef, useState } from "react";

import { countPeople } from "../../api/people";
import { listSCMessages } from "../../api/scMessages";
import { useCurrentUser } from "../../store/CurrentUserContext";
import type { SCMessage } from "../../types/scMessage";
import { canReadCouncilMessages } from "../../utils/permissions";
import { useLiveRefresh } from "../../websocket/LiveProvider";

// The numbers and newest unread messages of the Council's Home: GET /sc-messages/ (api-plan
// §10.6) and the optional people search count (§10.8). A new message notifies every council
// member, so the page re-fetches then. Read state changes by colleagues send no event: it also
// re-fetches when the tab is shown again (§9.4). A failed refresh keeps what is shown. The active
// workspace comes from the tab's storage, so the lists wait until /users/me/ confirms the role:
// asking without it would be a 403 in the console.
export function useCouncilOverview() {
  const { roles, isLoaded } = useCurrentUser();
  const isMember = isLoaded && canReadCouncilMessages(roles);
  const [unread, setUnread] = useState<SCMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hitchhikerCount, setHitchhikerCount] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoaded = useRef(false);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useLiveRefresh(["notification.created"], reload);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        reload();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reload]);

  useEffect(() => {
    if (!isMember) {
      return;
    }

    let active = true;

    Promise.all([listSCMessages({ unread: true }), listSCMessages()])
      .then(([unreadPage, allPage]) => {
        if (active) {
          hasLoaded.current = true;
          setUnread(unreadPage.results);
          setUnreadCount(unreadPage.count);
          setTotalCount(allPage.count);
          setHasError(false);
          setIsFirstLoad(false);
        }
      })
      .catch(() => {
        if (active && !hasLoaded.current) {
          setHasError(true);
          setIsFirstLoad(false);
        }
      });

    // Optional, and limited together with people search (§5.9): without it only its box is empty.
    countPeople("tutor")
      .then((count) => {
        if (active) {
          setHitchhikerCount(count);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isMember, reloadKey]);

  return { unread, unreadCount, totalCount, hitchhikerCount, isLoading: isFirstLoad, hasError };
}
