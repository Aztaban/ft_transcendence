import { useCallback, useEffect, useState } from "react";

import { cancelEvaluationRequest, listEvaluationRequests } from "../../api/evaluationRequests";
import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot, formatTimeAgo } from "../../utils/dateTime";
import CancelRequestDialog from "./CancelRequestDialog";
import { canCancel, cancelErrorMessage } from "./cancelRequest";
import "../../styles/my-requests.css";

type LoadState = "loading" | "ready" | "error";

type Tone = "blue" | "amber" | "teal" | "green" | "red" | "violet" | "grey";

// "minishell" → "MI", "RAG against the machine" → "RA"
function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

// Status labels (api-plan §7.1). Results are entered later in the Django admin, so a past
// confirmed request without `result` is "Result pending".
function statusLabel(request: EvaluationRequest): { label: string; tone: Tone } {
  switch (request.status) {
    case "pending":
      return { label: "Waiting for a Hitchhiker", tone: "blue" };
    case "awaiting_confirmation":
      return { label: "Needs your confirmation", tone: "amber" };
    case "cancelled":
      return { label: "Cancelled", tone: "grey" };
    case "expired":
      return { label: "Expired", tone: "grey" };
  }

  if (!request.is_history) {
    return { label: "Confirmed", tone: "teal" };
  }

  if (request.result === "passed") {
    return { label: "Passed", tone: "green" };
  }

  if (request.result === "failed") {
    return { label: "Failed", tone: "red" };
  }

  return { label: "Result pending", tone: "violet" };
}

interface RequestRowProps {
  request: EvaluationRequest;
  // Only active rows can be cancelled.
  onCancel?: (request: EvaluationRequest) => void;
}

function RequestRow({ request, onCancel }: RequestRowProps) {
  const status = statusLabel(request);

  return (
    <li className="my-requests__row">
      <span className="my-requests__badge" aria-hidden="true">
        {projectInitials(request.project.name)}
      </span>

      <div className="my-requests__project">
        <h4>{request.project.name}</h4>
        {request.starts_at && request.ends_at ? (
          <time dateTime={request.starts_at}>{formatSlot(request.starts_at, request.ends_at)}</time>
        ) : (
          <p>Requested {formatTimeAgo(request.created_at)}</p>
        )}
      </div>

      <span className={`my-requests__status my-requests__status--${status.tone}`}>
        {status.label}
      </span>

      {onCancel && canCancel(request) && (
        <button
          className="my-requests__cancel"
          type="button"
          aria-label={`Cancel the ${request.project.name} request`}
          onClick={() => onCancel(request)}
        >
          Cancel
        </button>
      )}
    </li>
  );
}

interface RequestList {
  requests: EvaluationRequest[];
  total: number;
  hasMore: boolean;
  loadState: LoadState;
  isLoadingMore: boolean;
  loadMore: () => void;
  // Loads the list again from its first page, e.g. after a cancel.
  reload: () => void;
}

// One paginated list of the student's requests (§5.7): the first page on mount, then
// "Show more" appends the next one.
function useRequestList(history: boolean): RequestList {
  const [requests, setRequests] = useState<EvaluationRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    listEvaluationRequests({ scope: "mine", history, page })
      .then((result) => {
        if (active) {
          setRequests((current) => (page === 1 ? result.results : [...current, ...result.results]));
          setTotal(result.count);
          setHasMore(result.next !== null);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active && page === 1) {
          setLoadState("error");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingMore(false);
        }
      });

    return () => {
      active = false;
    };
  }, [history, page, reloadKey]);

  return {
    requests,
    total,
    hasMore,
    loadState,
    isLoadingMore,
    loadMore: () => {
      setIsLoadingMore(true);
      setPage((current) => current + 1);
    },
    reload: () => {
      setPage(1);
      setReloadKey((key) => key + 1);
    },
  };
}

function ShowMore({ list, label }: { list: RequestList; label: string }) {
  if (!list.hasMore) {
    return null;
  }

  return (
    <button
      className="my-requests__more"
      type="button"
      disabled={list.isLoadingMore}
      onClick={list.loadMore}
    >
      {list.isLoadingMore
        ? "Loading…"
        : `Show more ${label} (${list.total - list.requests.length} left)`}
    </button>
  );
}

// "Your requests" on the student Request page (#189). Active and past requests are two
// separate paginated lists, as the contract maps them (api-plan §10.4):
// GET /evaluation-requests/?scope=mine&history=false and ?scope=mine&history=true.
// Each is loaded on its own, so an older active request is never pushed out by newer past ones.
// TODO: link each row to /evaluations/{id} once that page (#507) is merged.
function MyRequests() {
  const active = useRequestList(false);
  const past = useRequestList(true);
  const [cancelling, setCancelling] = useState<EvaluationRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [notice, setNotice] = useState("");

  const closeCancel = useCallback(() => {
    setCancelling(null);
    setCancelError("");
  }, []);

  // A cancelled request moves from the active list to the past one (api-plan §7.1, #595).
  async function handleCancel() {
    if (!cancelling) {
      return;
    }

    setCancelError("");
    setIsCancelling(true);

    try {
      await cancelEvaluationRequest(cancelling.id);
      setNotice(`Your ${cancelling.project.name} request was cancelled.`);
      setCancelling(null);
      active.reload();
      past.reload();
    } catch (error) {
      setCancelError(cancelErrorMessage(error));
    } finally {
      setIsCancelling(false);
    }
  }

  const loadState: LoadState =
    active.loadState === "error" || past.loadState === "error"
      ? "error"
      : active.loadState === "loading" || past.loadState === "loading"
        ? "loading"
        : "ready";
  const isEmpty = active.total === 0 && past.total === 0;

  return (
    <section className="my-requests" aria-labelledby="my-requests-title">
      <h2 id="my-requests-title">Your requests</h2>

      {notice && (
        <p className="my-requests__notice" role="status">
          {notice}
        </p>
      )}

      {loadState === "loading" && (
        <div className="my-requests__list" aria-busy="true">
          {[1, 2].map((placeholder) => (
            <div className="my-requests__skeleton" key={placeholder} />
          ))}
          <span className="my-requests__sr-only">Loading your requests…</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="my-requests__error" role="alert">
          Could not load your requests. Please try again later.
        </p>
      )}

      {loadState === "ready" && isEmpty && (
        <p className="my-requests__empty">You haven't requested an evaluation yet.</p>
      )}

      {loadState === "ready" && !isEmpty && (
        <>
          <div className="my-requests__group">
            <h3>Active</h3>
            {active.requests.length === 0 ? (
              <p className="my-requests__empty">No active requests.</p>
            ) : (
              <ul className="my-requests__list">
                {active.requests.map((request) => (
                  <RequestRow
                    request={request}
                    key={request.id}
                    onCancel={(chosen) => {
                      setNotice("");
                      setCancelling(chosen);
                    }}
                  />
                ))}
              </ul>
            )}
            <ShowMore list={active} label="active requests" />
          </div>

          {past.requests.length > 0 && (
            <div className="my-requests__group">
              <h3>Past</h3>
              <ul className="my-requests__list">
                {past.requests.map((request) => (
                  <RequestRow request={request} key={request.id} />
                ))}
              </ul>
              <ShowMore list={past} label="past requests" />
            </div>
          )}
        </>
      )}

      {cancelling && (
        <CancelRequestDialog
          request={cancelling}
          isSubmitting={isCancelling}
          error={cancelError}
          onConfirm={handleCancel}
          onClose={closeCancel}
        />
      )}
    </section>
  );
}

export default MyRequests;
