import { useEffect, useId, useState } from "react";

import { listProjects } from "../../api/projects";
import type { ProjectRef } from "../../types/project";
import "../../styles/project-select.css";

interface ProjectSelectProps {
  value: number | null;
  onChange: (projectId: number, project: ProjectRef) => void;
}

type LoadState = "loading" | "ready" | "error";

// "minishell" → "MI", "RAG against the machine" → "RA"
function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

// Project picker for "Create New Request – step 1" (Figma), filled from GET /api/v1/projects/.
// Native radio buttons styled as tiles, so arrow keys and screen readers work.
function ProjectSelect({ value, onChange }: ProjectSelectProps) {
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
      <legend className="project-select__label">Choose the project</legend>

      {loadState === "loading" && (
        <div className="project-select__grid" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((placeholder) => (
            <span className="project-select__skeleton" key={placeholder} />
          ))}
          <span className="project-select__sr-only">Loading projects…</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="project-select__error" role="alert">
          Could not load the projects. Please try again later.
        </p>
      )}

      {loadState === "ready" && projects.length === 0 && (
        <p className="project-select__empty">No projects available</p>
      )}

      {loadState === "ready" && projects.length > 0 && (
        <div className="project-select__grid">
          {projects.map((project) => (
            <label
              className={
                value === project.id
                  ? "project-select__tile project-select__tile--selected"
                  : "project-select__tile"
              }
              key={project.id}
            >
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
          ))}
        </div>
      )}
    </fieldset>
  );
}

export default ProjectSelect;
