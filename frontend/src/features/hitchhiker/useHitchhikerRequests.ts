import { useEffect, useState } from "react";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import type { EvaluationRequest } from "../../types/evaluation";

// The Hitchhiker's requests for the Home dashboard (api-plan §10.4):
// - open:   GET /evaluation-requests/?scope=open   (the queue to pick from)
// - picked: GET /evaluation-requests/?scope=picked (awaiting, upcoming and history)
// Only called once the user is logged in, so no 401 in the console.
// TODO: only the first page (20) of each list is loaded.
export function useHitchhikerRequests() {
  const { isAuthenticated } = useAuth();
  const [openRequests, setOpenRequests] = useState<EvaluationRequest[]>([]);
  const [pickedRequests, setPickedRequests] = useState<EvaluationRequest[]>([]);
  const [hasError, setHasError] = useState(false);

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
          setOpenRequests(open.results);
          setPickedRequests(picked.results);
          setHasError(false);
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  return { openRequests, pickedRequests, hasError };
}
