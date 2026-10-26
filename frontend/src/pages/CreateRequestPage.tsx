import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ApiError } from "../api/client";
import { createEvaluationRequest } from "../api/evaluationRequests";
import i18n from "../i18n";
import ProjectSelect from "../features/projects/ProjectSelect";
import InfoNotice from "../features/requests/InfoNotice";
import RequestSuccessDialog from "../features/requests/RequestSuccessDialog";
import MyRequests from "../features/student/MyRequests";
import type { ProjectRef } from "../types/project";
import "../styles/create-request.css";

// TODO(contract): the Figma flow has a middle step "Add your slots" (student availability).
// api-plan §7.1 / §10.4 have no student availability yet, so it is left out until the team decides.
const steps = [
  { id: "project", titleKey: "createRequest.stepProject" },
  { id: "confirm", titleKey: "createRequest.stepConfirm" },
] as const;

type StepId = (typeof steps)[number]["id"];

// The request lifecycle from the student's side (api-plan §7.1).
const howItWorks = ["Project", "Propose", "Confirm"];

// api-plan §10.4: `note` is optional, up to 500 characters.
const NOTE_MAX_LENGTH = 500;

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "active_request_exists") {
      return i18n.t("createRequest.errorActiveExists");
    }

    return error.fields?.project_id?.[0] ?? error.fields?.note?.[0] ?? error.message;
  }

  return i18n.t("createRequest.errorGeneric");
}

// The chosen project and note are kept for this browser tab, so opening a project's "Details"
// and coming back with Back does not lose them. Storage can be unavailable (private mode,
// blocked site data), so every access is guarded and the page works without it.
const DRAFT_KEY = "create-request-draft";

interface Draft {
  project: ProjectRef | null;
  note: string;
}

function readDraft(): Draft {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") as Partial<Draft> | null;

    return {
      project: saved?.project ?? null,
      note: typeof saved?.note === "string" ? saved.note.slice(0, NOTE_MAX_LENGTH) : "",
    };
  } catch {
    return { project: null, note: "" };
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft && (draft.project || draft.note)) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } else {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // The draft is a convenience only.
  }
}

function CreateRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stepId, setStepId] = useState<StepId>("project");
  const [project, setProject] = useState<ProjectRef | null>(() => readDraft().project);
  const [note, setNote] = useState(() => readDraft().note);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSent, setIsSent] = useState(false);

  const stepIndex = steps.findIndex((step) => step.id === stepId);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!isSent) {
      writeDraft({ project, note });
    }
  }, [project, note, isSent]);

  // Going back to change the request clears the last submit error, so it never shows up
  // under another project.
  function goToStep(nextStepId: StepId) {
    setSubmitError("");
    setStepId(nextStepId);
  }

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
      writeDraft(null);
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
            aria-label={t("createRequest.back")}
            disabled={isSubmitting}
            onClick={() => goToStep(steps[stepIndex - 1].id)}
          >
            ‹
          </button>
        )}

        <div>
          <h1>
            {stepId === "confirm" ? t("createRequest.confirmTitle") : t("createRequest.title")}
          </h1>
          <p className="create-request__step">
            {t("createRequest.step", {
              current: stepIndex + 1,
              total: steps.length,
              title: t(step.titleKey),
            })}
          </p>
        </div>
      </header>

      <div
        className="create-request__progress"
        role="progressbar"
        aria-label={t("createRequest.progress")}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
      >
        <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="create-request__layout">
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
                    {t("createRequest.noteLabel")} <span>{t("createRequest.optional")}</span>
                  </label>
                  <textarea
                    id="request-note"
                    value={note}
                    maxLength={NOTE_MAX_LENGTH}
                    rows={3}
                    placeholder={t("createRequest.notePlaceholder")}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <span className="create-request__note-count" aria-live="polite">
                    {note.length} / {NOTE_MAX_LENGTH}
                  </span>
                </div>
              </div>

              <InfoNotice>
                <p>{t("createRequest.lastEvaluation")}</p>
                <p>{t("createRequest.failWarning")}</p>
              </InfoNotice>

              <div className="create-request__actions">
                <button
                  className="create-request__button"
                  type="button"
                  disabled={!project}
                  onClick={() => setStepId("confirm")}
                >
                  {t("common.next")} <span aria-hidden="true">→</span>
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
                <p>{t("createRequest.summary")}</p>
                {note.trim() && (
                  <blockquote className="create-request__summary-note">
                    <span>{t("createRequest.yourNote")}</span>
                    <p>{note.trim()}</p>
                  </blockquote>
                )}
                <button
                  className="create-request__edit"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => goToStep("project")}
                >
                  {t("common.edit")}
                </button>
              </article>

              <InfoNotice>
                <p>{t("createRequest.visible")}</p>
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
                  {isSubmitting ? t("common.sending") : t("common.submit")}{" "}
                  <span aria-hidden="true">✓</span>
                </button>
              </div>
            </>
          )}
        </div>

        <aside className="create-request__aside">
          <section className="create-request__panel">
            <h2>{t("common.howItWorks")}</h2>
            <ol className="create-request__steps">
              {howItWorks.map((item) => (
                <li key={item}>
                  <strong>{t(`createRequest.how${item}Title`)}</strong>
                  <span>{t(`createRequest.how${item}Text`)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="create-request__panel create-request__panel--tip">
            <h2>{t("common.tip")}</h2>
            <p>{t("createRequest.tipText")}</p>
          </section>
        </aside>
      </div>

      {stepId === "project" && <MyRequests />}

      {isSent && <RequestSuccessDialog onClose={() => navigate("/")} />}
    </section>
  );
}

export default CreateRequestPage;
