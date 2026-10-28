import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "../api/client";
import { createEligibilityRequest } from "../api/eligibility";
import EligibilitySentDialog from "../features/hitchhiker/EligibilitySentDialog";
import ProjectMultiSelect from "../features/hitchhiker/ProjectMultiSelect";
import type { ProjectRef } from "../types/project";
import "../styles/eligibility-request.css";

const steps = [
  { id: "projects", title: "Select projects" },
  { id: "confirm", title: "Confirm your request" },
] as const;

type StepId = (typeof steps)[number]["id"];

// Becoming eligible, from the Hitchhiker's side (api-plan §7.2).
const howItWorks = [
  { title: "Choose your projects", text: "Select every project you want to evaluate." },
  { title: "A Head Tutor reviews", text: "They approve or decline the whole request." },
  { title: "Start evaluating", text: "Once approved, pick open requests for these projects." },
];

// The chosen projects are kept for this browser tab, so opening a project's "Details" and
// coming back with Back does not lose them. Storage can be unavailable (private mode, blocked
// site data), so every access is guarded and the page works without it.
const DRAFT_KEY = "eligibility-request-draft";

function isProjectRef(value: unknown): value is ProjectRef {
  const project = value as ProjectRef | null;

  return (
    typeof project === "object" &&
    project !== null &&
    typeof project.id === "number" &&
    typeof project.slug === "string" &&
    typeof project.name === "string"
  );
}

function readDraft(): ProjectRef[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "[]");

    return Array.isArray(saved) ? saved.filter(isProjectRef) : [];
  } catch {
    return [];
  }
}

function writeDraft(projects: ProjectRef[] | null) {
  try {
    if (projects && projects.length > 0) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(projects));
    } else {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // The draft is a convenience only.
  }
}

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "eligibility_request_pending") {
      return "You already have a request waiting for review.";
    }

    if (error.code === "permission_denied") {
      return "Only Hitchhikers can request to evaluate projects.";
    }

    return error.fields?.project_ids?.[0] ?? error.message;
  }

  return "Could not send your request. Please try again.";
}

// Hitchhiker eligibility request (#170, #171, #172): one request for every chosen project,
// reviewed as a whole by a Head Tutor (api-plan §7.2, §10.3).
function EligibilityRequestPage() {
  const navigate = useNavigate();
  const [stepId, setStepId] = useState<StepId>("projects");
  const [projects, setProjects] = useState<ProjectRef[]>(readDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSent, setIsSent] = useState(false);

  const stepIndex = steps.findIndex((step) => step.id === stepId);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!isSent) {
      writeDraft(projects);
    }
  }, [projects, isSent]);

  // Going back to change the request clears the last submit error, so it never shows up
  // under other projects.
  function goToStep(nextStepId: StepId) {
    setSubmitError("");
    setStepId(nextStepId);
  }

  async function handleSubmit() {
    setSubmitError("");
    setIsSubmitting(true);

    try {
      await createEligibilityRequest({ project_ids: projects.map((project) => project.id) });
      writeDraft(null);
      setIsSent(true);
    } catch (error) {
      setSubmitError(submitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="eligibility-request">
      <header className="eligibility-request__header">
        {stepIndex > 0 && (
          <button
            className="eligibility-request__back"
            type="button"
            aria-label="Back to the previous step"
            disabled={isSubmitting}
            onClick={() => goToStep(steps[stepIndex - 1].id)}
          >
            ‹
          </button>
        )}

        <div>
          <h1>{stepId === "confirm" ? "Confirmation" : "Projects you can evaluate"}</h1>
          <p className="eligibility-request__step">
            Step {stepIndex + 1} / {steps.length} · {step.title}
          </p>
        </div>
      </header>

      <div
        className="eligibility-request__progress"
        role="progressbar"
        aria-label="Request progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
      >
        <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="eligibility-request__layout">
        <div className="eligibility-request__body" key={stepId}>
          {stepId === "projects" && (
            <>
              <div className="eligibility-request__card">
                <ProjectMultiSelect value={projects} onChange={setProjects} />
              </div>

              <div className="eligibility-request__actions">
                <button
                  className="eligibility-request__button"
                  type="button"
                  disabled={projects.length === 0}
                  onClick={() => setStepId("confirm")}
                >
                  Next <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          )}

          {stepId === "confirm" && (
            <>
              <article className="eligibility-request__summary">
                <h2>
                  {projects.length === 1 ? "1 project" : `${projects.length} projects`} selected
                </h2>
                <ul className="eligibility-request__chosen">
                  {projects.map((project) => (
                    <li key={project.id}>{project.name}</li>
                  ))}
                </ul>
                <p>A Head Tutor will approve or decline the whole request.</p>
                <button
                  className="eligibility-request__edit"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => goToStep("projects")}
                >
                  Edit
                </button>
              </article>

              {submitError && (
                <p className="eligibility-request__error" role="alert">
                  {submitError}
                </p>
              )}

              <div className="eligibility-request__actions">
                <button
                  className="eligibility-request__button eligibility-request__button--submit"
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

        <aside className="eligibility-request__aside">
          <section className="eligibility-request__panel">
            <h2>How it works</h2>
            <ol className="eligibility-request__steps">
              {howItWorks.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="eligibility-request__panel eligibility-request__panel--tip">
            <h2>Tip</h2>
            <p>You can send another request later to add more projects.</p>
          </section>
        </aside>
      </div>

      {isSent && <EligibilitySentDialog onClose={() => navigate("/requests")} />}
    </section>
  );
}

export default EligibilityRequestPage;
