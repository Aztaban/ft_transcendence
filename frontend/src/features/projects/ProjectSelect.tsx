import { useEffect, useId, useState } from "react";

import { listProjects } from "../../api/projects";
import type { ProjectRef } from "../../types/project";
import "../../styles/project-select.css";

interface ProjectSelectProps {
  value: number | null;
  onChange: (projectId: number) => void;
}

type LoadState = "loading" | "ready" | "error";

function placeholderText(loadState: LoadState, isEmpty: boolean) {
  if (loadState === "loading") {
    return "Loading projects…";
  }

  if (isEmpty) {
    return "No projects available";
  }

  return "Select a project";
}

// Project dropdown for "Create New Request – step 1/3" (Figma), filled from GET /api/v1/projects/.
function ProjectSelect({ value, onChange }: ProjectSelectProps) {
  const selectId = useId();
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

  const isEmpty = loadState === "ready" && projects.length === 0;

  return (
    <div className="project-select">
      <label className="project-select__label" htmlFor={selectId}>
        Choose the project
      </label>

      <div className={`project-select__control project-select__control--${loadState}`}>
        <select
          id={selectId}
          className="project-select__input"
          value={value ?? ""}
          disabled={loadState !== "ready" || isEmpty}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="" disabled>
            {placeholderText(loadState, isEmpty)}
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <span className="project-select__chevron" aria-hidden="true" />
      </div>

      {loadState === "error" && (
        <p className="project-select__error" role="alert">
          Could not load the projects. Please try again later.
        </p>
      )}
    </div>
  );
}

export default ProjectSelect;
