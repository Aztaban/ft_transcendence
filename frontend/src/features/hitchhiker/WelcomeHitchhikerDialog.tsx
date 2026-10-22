import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client";
import { createEligibilityRequest } from "../../api/eligibility";
import { listProjects } from "../../api/projects";
import hitchhikersIcon from "../../assets/figma/hitchhikers.svg";
import useDialog from "../../components/ui/useDialog";
import i18n from "../../i18n";
import type { ProjectRef } from "../../types/project";
import "../../styles/welcome-hitchhiker.css";

interface WelcomeHitchhikerDialogProps {
  onClose: () => void;
}

type View = "form" | "sent";

// Badge colors, in turn: teal, amber, blue, violet (the dashboard section tones).
const TONES = ["teal", "amber", "blue", "violet"] as const;

// "minishell" → "MI", "RAG against the machine" → "RA"
function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "eligibility_request_pending") {
      return i18n.t("welcome.errorPending");
    }

    if (error.code === "permission_denied") {
      return i18n.t("welcome.errorPermission");
    }

    return error.fields?.project_ids?.[0] ?? error.message;
  }

  return i18n.t("createRequest.errorGeneric");
}

// Figma "Welcome Hitchhiker" popup, shown the first time a Hitchhiker opens their workspace
// (#169). Sends one eligibility request (api-plan §7.2, §10.3), then shows "Form sent!".
// Projects can be added later from /eligibility-requests/new.
function WelcomeHitchhikerDialog({ onClose }: WelcomeHitchhikerDialogProps) {
  const { t } = useTranslation();
  const cardRef = useDialog<HTMLDivElement>(onClose);
  const [view, setView] = useState<View>("form");
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let active = true;

    listProjects()
      .then((result) => {
        if (active) {
          setProjects(result);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // "Form sent!" is a new card: it gets the focus too.
  useEffect(() => {
    cardRef.current?.focus();
  }, [view, cardRef]);

  function toggle(projectId: number) {
    setSelectedIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  async function handleSubmit() {
    setSubmitError("");
    setIsSubmitting(true);

    try {
      // Keep the API order (sorted by name).
      const projectIds = projects
        .filter((project) => selectedIds.includes(project.id))
        .map((project) => project.id);

      await createEligibilityRequest({ project_ids: projectIds });
      setView("sent");
    } catch (error) {
      setSubmitError(submitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (view === "sent") {
    return (
      <div className="welcome-dialog" data-testid="welcome-dialog-backdrop" onClick={onClose}>
        <div
          ref={cardRef}
          className="welcome-dialog__card welcome-dialog__card--sent"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-sent-title"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div>
            <span className="welcome-dialog__done" aria-hidden="true">
              ✓
            </span>
            <h2 id="welcome-sent-title">{t("welcome.sentTitle")}</h2>
            <p>{t("welcome.sentText")}</p>
            <p>{t("welcome.thanks")}</p>
          </div>
          <img className="welcome-dialog__image" src={hitchhikersIcon} alt="" aria-hidden="true" />
          <p className="welcome-dialog__hint">{t("common.clickToClose")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-dialog">
      <div
        ref={cardRef}
        className="welcome-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-subtitle"
        tabIndex={-1}
      >
        <img className="welcome-dialog__logo" src={hitchhikersIcon} alt="" aria-hidden="true" />
        <h2 id="welcome-title">{t("welcome.title")}</h2>
        <p id="welcome-subtitle" className="welcome-dialog__subtitle">
          {t("welcome.subtitle")}
        </p>

        {loadError ? (
          <p className="welcome-dialog__error" role="alert">
            {t("projectSelect.error")}
          </p>
        ) : (
          <fieldset className="welcome-dialog__projects" aria-busy={projects.length === 0}>
            <legend className="welcome-dialog__sr-only">{t("welcome.projects")}</legend>
            {projects.map((project, index) => (
              <label
                className={
                  selectedIds.includes(project.id)
                    ? "welcome-dialog__project welcome-dialog__project--selected"
                    : "welcome-dialog__project"
                }
                key={project.id}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(project.id)}
                  onChange={() => toggle(project.id)}
                />
                <span
                  className={`welcome-dialog__badge welcome-dialog__badge--${TONES[index % TONES.length]}`}
                  aria-hidden="true"
                >
                  {projectInitials(project.name)}
                </span>
                <span className="welcome-dialog__name">{project.name}</span>
              </label>
            ))}
          </fieldset>
        )}

        {submitError && (
          <p className="welcome-dialog__error" role="alert">
            {submitError}
          </p>
        )}

        <div className="welcome-dialog__actions">
          <span className="welcome-dialog__count" aria-live="polite">
            {t("welcome.selected", { count: selectedIds.length })}
          </span>
          <button className="welcome-dialog__later" type="button" onClick={onClose}>
            {t("welcome.notNow")}
          </button>
          <button
            className="welcome-dialog__submit"
            type="button"
            disabled={selectedIds.length === 0 || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? t("common.sending") : t("common.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeHitchhikerDialog;
