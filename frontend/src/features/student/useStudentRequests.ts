import { useCallback, useEffect, useState } from "react";

import { listEvaluationRequests } from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import type { EvaluationRequest } from "../../types/evaluation";

// All of the student's requests for the Home dashboard (open, scheduled and history):
// GET /evaluation-requests/?scope=mine (api-plan §10.4). Each box filters what it shows.
// TODO: only the first page (20) is loaded; add paging when students have more requests.
// Only called once the session check says the user is logged in, so no 401 in the console.
export function useStudentRequests() {
  const { isAuthenticated } = useAuth();
  const [requests, setRequests] = useState<EvaluationRequest[]>([]);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const page = await listEvaluationRequests({ scope: "mine" });

      setRequests(page.results);
      setHasError(false);
    } catch {
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void reload();
    }
  }, [isAuthenticated, reload]);

  return { requests, hasError, reload };
}
