import { useEffect, useState } from "react";
import { Link } from "react-router";

import { listProjects } from "../../api/projects";
import type { ProjectRef } from "../../types/project";
import { projectInitials } from "../projects/ProjectOverview";

interface ProjectMultiSelectProps {
  value: ProjectRef[];
  onChange: (projects: ProjectRef[]) => void;
}

type LoadState = "loading" | "ready" | "error";

// Project picker for the eligibility request (#170, #171), filled from GET /api/v1/projects/.
// Native checkboxes styled as tiles. "Details" sits outside each label, so opening a project
// does not select it. The chosen projects keep the API order (sorted by name).
function ProjectMultiSelect({ value, onChange }: ProjectMultiSelectProps) {
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

  const selectedIds = new Set(value.map((project) => project.id));
  const allSelected = projects.length > 0 && selectedIds.size === projects.length;

  function toggle(project: ProjectRef) {
    const next = new Set(selectedIds);

    if (next.has(project.id)) {
      next.delete(project.id);
    } else {
      next.add(project.id);
    }

    onChange(projects.filter((item) => next.has(item.id)));
  }

  return (
    <fieldset className="project-multi">
      <legend className="project-multi__label">Choose the projects you want to evaluate</legend>

      {loadState === "loading" && (
        <div className="project-multi__grid" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((placeholder) => (
            <span className="project-multi__skeleton" key={placeholder} />
          ))}
          <span className="project-multi__sr-only">Loading projects…</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="project-multi__error" role="alert">
          Could not load the projects. Please try again later.
        </p>
      )}

      {loadState === "ready" && projects.length === 0 && (
        <p className="project-multi__empty">No projects available</p>
      )}

      {loadState === "ready" && projects.length > 0 && (
        <>
          <div className="project-multi__toolbar">
            <span className="project-multi__count" aria-live="polite">
              {selectedIds.size} of {projects.length} selected
            </span>
            <button
              className="project-multi__all"
              type="button"
              onClick={() => onChange(allSelected ? [] : projects)}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          <div className="project-multi__grid">
            {projects.map((project) => {
              const isSelected = selectedIds.has(project.id);

              return (
                <div
                  className={
                    isSelected
                      ? "project-multi__tile project-multi__tile--selected"
                      : "project-multi__tile"
                  }
                  key={project.id}
                >
                  <label className="project-multi__choice">
                    <input
                      className="project-multi__checkbox"
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(project)}
                    />
                    <span className="project-multi__badge" aria-hidden="true">
                      {projectInitials(project.name)}
                    </span>
                    <span className="project-multi__name">{project.name}</span>
                    <span className="project-multi__check" aria-hidden="true">
                      ✓
                    </span>
                  </label>
                  <Link
                    className="project-multi__details"
                    to={`/projects/${project.slug}`}
                    aria-label={`Details about ${project.name}`}
                  >
                    Details <span aria-hidden="true">→</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </fieldset>
  );
}

export default ProjectMultiSelect;
