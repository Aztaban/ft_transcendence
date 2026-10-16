import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../api/client";
import {
  cancelEvaluationRequest,
  listEvaluationRequests,
  releaseEvaluationRequest,
} from "../api/evaluationRequests";
import CancelDialog, { type PendingViewer } from "../features/pending/CancelDialog";
import PreviewDialog from "../features/pending/PreviewDialog";
import { projectInitials } from "../features/projects/ProjectOverview";
import { useRole } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import { formatDayHeading, formatDuration, formatTime } from "../utils/dateTime";
import "../styles/pending.css";

type LoadState = "loading" | "ready" | "error";

interface OpenCancel {
  evaluation: EvaluationRequest;
  isDone: boolean;
}

// api-plan §10.4 "How the pages map": a student's Pending Evaluations are their confirmed active
// requests; a Hitchhiker's are the active requests they picked (also those still waiting for the
// student to confirm). Soonest first.
function loadPending(viewer: PendingViewer) {
  return viewer === "student"
    ? listEvaluationRequests({
        scope: "mine",
        status: ["confirmed"],
        history: false,
        ordering: "starts_at",
      })
    : listEvaluationRequests({ scope: "picked", history: false, ordering: "starts_at" });
}

function statusLabel(evaluation: EvaluationRequest) {
  return evaluation.status === "awaiting_confirmation" ? "Waiting for the student" : "Scheduled";
}

function otherPerson(evaluation: EvaluationRequest, viewer: PendingViewer) {
  if (viewer === "student") {
    return evaluation.picked_by
      ? { label: "Hitchhiker", name: evaluation.picked_by.display_name }
      : null;
  }

  // The picking Hitchhiker sees the student, but `student` can be null (R15, api-plan §8.7).
  return evaluation.student ? { label: "Student", name: evaluation.student.display_name } : null;
}

function cancelErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "evaluation_already_started") {
      return "This evaluation has already started, so it can't be cancelled.";
    }

    return error.message;
  }

  return "Could not cancel the evaluation. Please try again.";
}

// Groups the evaluations by local day, keeping the API order (soonest first).
function groupByDay(evaluations: EvaluationRequest[]) {
  const groups: { key: string; startsAt: string; items: EvaluationRequest[] }[] = [];

  for (const evaluation of evaluations) {
    if (!evaluation.starts_at) {
      continue;
    }

    const key = new Date(evaluation.starts_at).toDateString();
    const group = groups.find((item) => item.key === key);

    if (group) {
      group.items.push(evaluation);
    } else {
      groups.push({ key, startsAt: evaluation.starts_at, items: [evaluation] });
    }
  }

  return groups;
}

// Sidebar "Pending" (#536): upcoming evaluations by day, with Preview and Cancel (Figma
// "Pending Evaluations", "Upcoming Evaluation Details", "Cancel Eval").
function PendingPage() {
  const { activeRole } = useRole();
  const viewer: PendingViewer = activeRole === "HITCHHIKER" ? "hitchhiker" : "student";
  const [evaluations, setEvaluations] = useState<EvaluationRequest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<EvaluationRequest | null>(null);
  const [cancel, setCancel] = useState<OpenCancel | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    let active = true;

    setLoadState("loading");
    loadPending(viewer)
      .then((page) => {
        if (active) {
          setEvaluations(page.results);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [viewer, reloadKey]);

  const closeCancel = useCallback(() => {
    setCancel(null);
    setCancelError("");
  }, []);

  async function handleCancel() {
    if (!cancel) {
      return;
    }

    setCancelError("");
    setIsCancelling(true);

    try {
      if (viewer === "student") {
        await cancelEvaluationRequest(cancel.evaluation.id);
      } else {
        await releaseEvaluationRequest(cancel.evaluation.id);
      }

      setCancel({ ...cancel, isDone: true });
      setReloadKey((key) => key + 1);
    } catch (error) {
      setCancelError(cancelErrorMessage(error));
    } finally {
      setIsCancelling(false);
    }
  }

  const now = Date.now();
  const groups = groupByDay(evaluations);

  return (
    <section className="pending-page">
      <header className="pending-page__header">
        <h1>Pending Evaluations</h1>
        <p>
          {viewer === "student"
            ? "Your confirmed evaluations, soonest first."
            : "The evaluations you picked, soonest first."}
        </p>
      </header>

      <aside className="pending-page__notice">
        <span aria-hidden="true">i</span>
        <p>You can cancel anytime before the evaluation starts.</p>
      </aside>

      {loadState === "loading" && (
        <div className="pending-page__list" aria-busy="true">
          {[1, 2].map((placeholder) => (
            <div className="pending-page__skeleton" key={placeholder} />
          ))}
          <span className="pending-page__sr-only">Loading evaluations…</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="pending-page__error" role="alert">
          Could not load your evaluations. Please try again later.
        </p>
      )}

      {loadState === "ready" && groups.length === 0 && (
        <div className="pending-page__empty">
          <h2>Nothing scheduled yet</h2>
          <p>
            {viewer === "student"
              ? "Once you confirm a time proposed by a Hitchhiker, it will appear here."
              : "Pick an open request and it will appear here."}
          </p>
        </div>
      )}

      {loadState === "ready" &&
        groups.map((group) => (
          <section
            className="pending-page__day"
            key={group.key}
            aria-label={formatDayHeading(group.startsAt)}
          >
            <h2>{formatDayHeading(group.startsAt)}</h2>

            <ul className="pending-page__list">
              {group.items.map((evaluation) => {
                const startsAt = evaluation.starts_at as string;
                const endsAt = evaluation.ends_at as string;
                const person = otherPerson(evaluation, viewer);
                const hasStarted = new Date(startsAt).getTime() <= now;

                return (
                  <li
                    className={`pending-card pending-card--${evaluation.status}`}
                    key={evaluation.id}
                  >
                    <span className="pending-card__badge" aria-hidden="true">
                      {projectInitials(evaluation.project.name)}
                    </span>

                    <div className="pending-card__main">
                      <div className="pending-card__title">
                        <h3>{evaluation.project.name}</h3>
                        <span className="pending-card__status">
                          {hasStarted ? "In progress" : statusLabel(evaluation)}
                        </span>
                      </div>

                      <dl className="pending-card__facts">
                        <div>
                          <dt>Time</dt>
                          <dd>
                            <time dateTime={startsAt}>
                              {formatTime(startsAt)} – {formatTime(endsAt)}
                            </time>
                          </dd>
                        </div>
                        <div>
                          <dt>Duration</dt>
                          <dd>{formatDuration(startsAt, endsAt)}</dd>
                        </div>
                        <div>
                          <dt>Campus</dt>
                          <dd>42 Prague</dd>
                        </div>
                        {person && (
                          <div>
                            <dt>{person.label}</dt>
                            <dd>{person.name}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div className="pending-card__actions">
                      <button
                        className="pending-card__preview"
                        type="button"
                        aria-label={`Preview ${evaluation.project.name}`}
                        onClick={() => setPreview(evaluation)}
                      >
                        Preview
                      </button>
                      <button
                        className="pending-card__cancel"
                        type="button"
                        disabled={hasStarted}
                        aria-label={`Cancel ${evaluation.project.name}`}
                        onClick={() => setCancel({ evaluation, isDone: false })}
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      {preview && (
        <PreviewDialog
          evaluation={preview}
          otherPerson={otherPerson(preview, viewer)}
          statusLabel={statusLabel(preview)}
          onClose={() => setPreview(null)}
        />
      )}

      {cancel && (
        <CancelDialog
          key={cancel.isDone ? "done" : "confirm"}
          evaluation={cancel.evaluation}
          viewer={viewer}
          isDone={cancel.isDone}
          isSubmitting={isCancelling}
          error={cancelError}
          onConfirm={handleCancel}
          onClose={closeCancel}
        />
      )}
    </section>
  );
}

export default PendingPage;
