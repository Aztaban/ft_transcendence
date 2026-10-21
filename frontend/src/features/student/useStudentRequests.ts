import { useCallback, useEffect, useRef, useState } from "react";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import type { EvaluationRequest } from "../../types/evaluation";
import { EVALUATION_EVENTS } from "../../websocket/events";
import { useLiveRefresh } from "../../websocket/LiveProvider";

// All of the student's requests for the Home dashboard (open, scheduled and history):
// GET /evaluation-requests/?scope=mine (api-plan §10.4). Each box filters what it shows.
// TODO: only the first page (20) is loaded; add paging when students have more requests.
// Only called once the session check says the user is logged in, so no 401 in the console.
// Re-fetched in the background when one of the requests changes or after a reconnect (§9,
// #254); a failed refresh keeps the requests already shown.
export function useStudentRequests() {
  const { isAuthenticated, isLoading: isCheckingSession } = useAuth();
  const [requests, setRequests] = useState<EvaluationRequest[]>([]);
  const [hasError, setHasError] = useState(false);
  // True until the first answer arrives or the first load fails; a background refresh keeps it
  // false, so the requests already shown stay on screen (#258).
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoaded = useRef(false);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useLiveRefresh(EVALUATION_EVENTS, reload);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let active = true;

    listEvaluationRequests({ scope: "mine" })
      .then((page) => {
        if (active) {
          hasLoaded.current = true;
          setRequests(page.results);
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

  return { requests, isLoading, hasError, reload };
}
