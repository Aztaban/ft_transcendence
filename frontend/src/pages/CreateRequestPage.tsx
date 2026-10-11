import { useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "../api/client";
import { createEvaluationRequest } from "../api/evaluationRequests";
import ProjectSelect from "../features/projects/ProjectSelect";
import InfoNotice from "../features/requests/InfoNotice";
import RequestSuccessDialog from "../features/requests/RequestSuccessDialog";
import type { ProjectRef } from "../types/project";
import "../styles/create-request.css";

// TODO(contract): the Figma flow has a middle step "Add your slots" (student availability).
// api-plan §7.1 / §10.4 have no student availability yet, so it is left out until the team decides.
const steps = [
  { id: "project", title: "Select Project" },
  { id: "confirm", title: "Confirm your request" },
] as const;

type StepId = (typeof steps)[number]["id"];

// api-plan §10.4: `note` is optional, up to 500 characters.
const NOTE_MAX_LENGTH = 500;

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "active_request_exists") {
      return "You already have an active request for this project.";
    }

    if (error.code === "not_authenticated") {
      return "Your session has expired. Please log in again.";
    }

    return error.fields?.project_id?.[0] ?? error.fields?.note?.[0] ?? error.message;
  }

  return "Could not send your request. Please try again.";
}

function CreateRequestPage() {
  const navigate = useNavigate();
  const [stepId, setStepId] = useState<StepId>("project");
  const [project, setProject] = useState<ProjectRef | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSent, setIsSent] = useState(false);

  const stepIndex = steps.findIndex((step) => step.id === stepId);
  const step = steps[stepIndex];

  async function handleSubmit() {
    if (!project) {
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const trimmedNote = note.trim();

      await createEvaluationRequest(
        trimmedNote ? { project_id: project.id, note: trimmedNote } : { project_id: project.id },
      );
      setIsSent(true);
    } catch (error) {
      setSubmitError(submitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="create-request">
      <header className="create-request__header">
        {stepIndex > 0 && (
          <button
            className="create-request__back"
            type="button"
            aria-label="Back to the previous step"
            onClick={() => setStepId(steps[stepIndex - 1].id)}
          >
            ‹
          </button>
        )}

        <div>
          <h1>{stepId === "confirm" ? "Confirmation" : "Create New Request"}</h1>
          <p className="create-request__step">
            Step {stepIndex + 1} / {steps.length} · {step.title}
          </p>
        </div>
      </header>

      <div
        className="create-request__progress"
        role="progressbar"
        aria-label="Request progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
      >
        <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="create-request__body" key={stepId}>
        {stepId === "project" && (
          <>
            <div className="create-request__card">
              <ProjectSelect
                value={project?.id ?? null}
                onChange={(_projectId, chosenProject) => setProject(chosenProject)}
              />

              <div className="create-request__note">
                <label htmlFor="request-note">
                  Note for the Hitchhiker <span>(optional)</span>
                </label>
                <textarea
                  id="request-note"
                  value={note}
                  maxLength={NOTE_MAX_LENGTH}
                  rows={3}
                  placeholder="e.g. I'm free after 18:00 until 21:00 on Friday and Saturday."
                  onChange={(event) => setNote(event.target.value)}
                />
                <span className="create-request__note-count" aria-live="polite">
                  {note.length} / {NOTE_MAX_LENGTH}
                </span>
              </div>
            </div>

            <InfoNotice>
              <p>
                Before requesting your evaluation, make sure the Hitchhiker evaluation is the last
                evaluation, after receiving two successful peer evaluations.
              </p>
              <p>
                If you request the Hitchhiker evaluation before meeting this requirement, your
                evaluation will fail immediately.
              </p>
            </InfoNotice>

            <div className="create-request__actions">
              <button
                className="create-request__button"
                type="button"
                disabled={!project}
                onClick={() => setStepId("confirm")}
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}

        {stepId === "confirm" && project && (
          <>
            <article className="create-request__summary">
              <div className="create-request__summary-head">
                <span className="create-request__summary-icon" aria-hidden="true">
                  ⛁
                </span>
                <h2>{project.name}</h2>
              </div>
              <p>A Hitchhiker who can evaluate this project will propose a time slot.</p>
              {note.trim() && (
                <blockquote className="create-request__summary-note">
                  <span>Your note</span>
                  <p>{note.trim()}</p>
                </blockquote>
              )}
              <button
                className="create-request__edit"
                type="button"
                onClick={() => setStepId("project")}
              >
                Edit
              </button>
            </article>

            <InfoNotice>
              <p>Your request will be visible to Hitchhikers who can evaluate this project.</p>
            </InfoNotice>

            {submitError && (
              <p className="create-request__error" role="alert">
                {submitError}
              </p>
            )}

            <div className="create-request__actions">
              <button
                className="create-request__button create-request__button--submit"
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Sending…" : "Submit"} <span aria-hidden="true">✓</span>
              </button>
            </div>
          </>
        )}
      </div>

      {isSent && <RequestSuccessDialog onClose={() => navigate("/")} />}
    </section>
  );
}

export default CreateRequestPage;
