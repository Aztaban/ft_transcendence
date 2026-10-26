import { useEffect, useRef, useState } from "react";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import type { EvaluationRequest } from "../../types/evaluation";
import { OPEN_QUEUE_EVENTS } from "../../websocket/events";
import { useLiveRefresh } from "../../websocket/LiveProvider";

// The Hitchhiker's requests for the Home dashboard (api-plan §10.4):
// - open:   GET /evaluation-requests/?scope=open   (the queue to pick from)
// - picked: GET /evaluation-requests/?scope=picked (awaiting, upcoming and history)
// Only called once the user is logged in, so no 401 in the console.
// Re-fetched in the background when a request or the Hitchhiker's eligibility changes, or after a
// reconnect (§9, #254); a failed refresh keeps the requests already shown.
// TODO: only the first page (20) of each list is loaded.
export function useHitchhikerRequests() {
  const { isAuthenticated, isLoading: isCheckingSession } = useAuth();
  const [openRequests, setOpenRequests] = useState<EvaluationRequest[]>([]);
  const [pickedRequests, setPickedRequests] = useState<EvaluationRequest[]>([]);
  const [hasError, setHasError] = useState(false);
  // True until the first answers arrive or the first load fails; a background refresh keeps it
  // false, so the requests already shown stay on screen (#258).
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoaded = useRef(false);

  useLiveRefresh(OPEN_QUEUE_EVENTS, () => setReloadKey((key) => key + 1));

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let active = true;

    Promise.all([
      listEvaluationRequests({ scope: "open" }),
      listEvaluationRequests({ scope: "picked" }),
    ])
      .then(([open, picked]) => {
        if (active) {
          hasLoaded.current = true;
          setOpenRequests(open.results);
          setPickedRequests(picked.results);
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

  // Loading while the session check runs and, once logged in, until the first answer. Logged out,
  // nothing is loaded, so there is nothing to wait for.
  const isLoading = isCheckingSession || (isAuthenticated && isFirstLoad);

  return { openRequests, pickedRequests, isLoading, hasError };
}
