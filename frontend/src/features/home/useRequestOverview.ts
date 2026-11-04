import { useEffect, useState } from "react";

import {
  listEvaluationRequests,
  type ListEvaluationRequestsParams,
} from "../../api/evaluationRequests";
import { useAuth } from "../../store/AuthContext";
import type { EvaluationRequest } from "../../types/evaluation";
import type { Paginated } from "../../types/pagination";
import type { LiveEventName } from "../../websocket/events";
import { useLiveRefresh } from "../../websocket/LiveProvider";

export type RequestOverview<Key extends string> = Partial<
  Record<Key, Paginated<EvaluationRequest>>
>;

// The numbers of the Home overview, from filtered lists: each list's `count` is its real total,
// not what fits on one page (api-plan §5.7, §10.4). Every list stands alone, so a failure only
// leaves its own box without a number, and a failed refresh keeps the last answer.
export function useRequestOverview<Key extends string>(
  queries: Record<Key, ListEvaluationRequestsParams>,
  events: readonly LiveEventName[],
) {
  const { isAuthenticated } = useAuth();
  const [overview, setOverview] = useState<RequestOverview<Key>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useLiveRefresh(events, () => setReloadKey((key) => key + 1));

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let active = true;
    const keys = Object.keys(queries) as Key[];

    void Promise.allSettled(keys.map((key) => listEvaluationRequests(queries[key]))).then(
      (answers) => {
        if (active) {
          setOverview((current) => {
            const next = { ...current };

            answers.forEach((answer, index) => {
              if (answer.status === "fulfilled") {
                next[keys[index]] = answer.value;
              }
            });

            return next;
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [queries, isAuthenticated, reloadKey]);

  return overview;
}
