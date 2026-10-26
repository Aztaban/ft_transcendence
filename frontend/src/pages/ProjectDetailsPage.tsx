import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiError } from "../api/client";
import { getProject } from "../api/projects";
import ProjectOverview, { projectInitials } from "../features/projects/ProjectOverview";
import type { Project } from "../types/project";
import "../styles/project-details.css";

type LoadState = "loading" | "ready" | "not-found" | "error";

// /projects/{slug}: a project's topics and info, from GET /api/v1/projects/{slug}/
// (api-plan §8.6, §10.3), #168. Logged-out users never get here: the app sends them to the
// login page first (#328).
function ProjectDetailsPage() {
  const { slug = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;

    setLoadState("loading");
    getProject(slug)
      .then((result) => {
        if (active) {
          setProject(result);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadState(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <section className="project-details">
      <Link className="project-details__back" to="/">
        <span aria-hidden="true">‹</span> Back to home
      </Link>

      {loadState === "loading" && <div className="project-details__skeleton" aria-busy="true" />}

      {loadState === "not-found" && (
        <p className="project-details__error" role="alert">
          This project does not exist or is not open for evaluations.
        </p>
      )}

      {loadState === "error" && (
        <p className="project-details__error" role="alert">
          Could not load the project. Please try again later.
        </p>
      )}

      {loadState === "ready" && project && (
        <>
          <header className="project-details__header">
            <span className="project-details__badge" aria-hidden="true">
              {projectInitials(project.name)}
            </span>
            <div>
              <h1>{project.name}</h1>
              <p>Hitchhiker evaluation</p>
            </div>
          </header>

          <ProjectOverview project={project} />
        </>
      )}
    </section>
  );
}

export default ProjectDetailsPage;
