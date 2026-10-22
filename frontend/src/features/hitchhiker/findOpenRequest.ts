import { listEvaluationRequests } from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";

// The open request with this id from GET /evaluation-requests/?scope=open (§10.4), or `null`
// once it is not open for this Hitchhiker anymore (picked by someone else, cancelled or
// expired). Reading the open list, page by page, instead of GET /evaluation-requests/{id}/
// means a request that disappeared answers 200 without it, not 404: a 404 is a red line in the
// browser console (§8.7: other Hitchhikers see a request only while it is pending).
export async function findOpenRequest(
  id: number,
  project?: string,
): Promise<EvaluationRequest | null> {
  for (let page = 1; ; page += 1) {
    const result = await listEvaluationRequests({ scope: "open", project, page });
    const found = result.results.find((request) => request.id === id);

    if (found) {
      return found;
    }

    if (result.next === null) {
      return null;
    }
  }
}
