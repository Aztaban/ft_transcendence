import { useCallback, useEffect, useRef, useState } from "react";

import { countPeople } from "../../api/people";
import { listSCMessages } from "../../api/scMessages";
import { useAuth } from "../../store/AuthContext";
import type { SCMessage } from "../../types/scMessage";
import { useLiveRefresh } from "../../websocket/LiveProvider";

// The numbers and newest unread messages of the Council's Home: GET /sc-messages/ (api-plan
// §10.6) and the people search count (§10.8). A new message notifies every council member, so
// the page re-fetches then; a failed refresh keeps what is shown.
export function useCouncilOverview() {
  const { isAuthenticated, isLoading: isCheckingSession } = useAuth();
  const [unread, setUnread] = useState<SCMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hitchhikerCount, setHitchhikerCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoaded = useRef(false);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useLiveRefresh(["notification.created"], reload);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let active = true;

    Promise.all([listSCMessages({ unread: true }), listSCMessages(), countPeople("tutor")])
      .then(([unreadPage, allPage, hitchhikers]) => {
        if (active) {
          hasLoaded.current = true;
          setUnread(unreadPage.results);
          setUnreadCount(unreadPage.count);
          setTotalCount(allPage.count);
          setHitchhikerCount(hitchhikers);
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

    return () => {
      active = false;
    };
  }, [isAuthenticated, reloadKey]);

  const isLoading = isCheckingSession || (isAuthenticated && isFirstLoad);

  return { unread, unreadCount, totalCount, hitchhikerCount, isLoading, hasError };
}
