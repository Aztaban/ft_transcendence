import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { listProjects } from "../../api/projects";
import type { ProjectRef } from "../../types/project";
import { projectInitials } from "./ProjectOverview";
import "../../styles/project-select.css";

interface ProjectSelectProps {
  value: number | null;
  onChange: (projectId: number, project: ProjectRef) => void;
}

type LoadState = "loading" | "ready" | "error";

// Project picker for "Create New Request – step 1" (Figma), filled from GET /api/v1/projects/.
// Native radio buttons styled as tiles, so arrow keys and screen readers work.
// "Details" sits outside the radio's label, so opening a project does not select it.
function ProjectSelect({ value, onChange }: ProjectSelectProps) {
  const { t } = useTranslation();
  const groupName = useId();
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;

    listProjects()
      .then((result) => {
        if (active) {
          setProjects(result);
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
  }, []);

  return (
    <fieldset className="project-select">
      <legend className="project-select__label">{t("projectSelect.legend")}</legend>

      {loadState === "loading" && (
        <div className="project-select__grid" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((placeholder) => (
            <span className="project-select__skeleton" key={placeholder} />
          ))}
          <span className="project-select__sr-only">{t("projectSelect.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="project-select__error" role="alert">
          {t("projectSelect.error")}
        </p>
      )}

      {loadState === "ready" && projects.length === 0 && (
        <p className="project-select__empty">{t("projectSelect.empty")}</p>
      )}

      {loadState === "ready" && projects.length > 0 && (
        <div className="project-select__grid">
          {projects.map((project) => (
            <div
              className={
                value === project.id
                  ? "project-select__tile project-select__tile--selected"
                  : "project-select__tile"
              }
              key={project.id}
            >
              <label className="project-select__choice">
                <input
                  className="project-select__radio"
                  type="radio"
                  name={groupName}
                  value={project.id}
                  checked={value === project.id}
                  onChange={() => onChange(project.id, project)}
                />
                <span className="project-select__badge" aria-hidden="true">
                  {projectInitials(project.name)}
                </span>
                <span className="project-select__name">{project.name}</span>
                <span className="project-select__check" aria-hidden="true">
                  ✓
                </span>
              </label>
              <Link
                className="project-select__details"
                to={`/projects/${project.slug}`}
                aria-label={t("projectSelect.detailsAria", { project: project.name })}
              >
                {t("projectSelect.details")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export default ProjectSelect;
