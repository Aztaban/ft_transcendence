import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";

import { ApiError } from "../api/client";
import { getProject } from "../api/projects";
import ProjectOverview, { projectInitials } from "../features/projects/ProjectOverview";
import { useAuth } from "../store/AuthContext";
import type { Project } from "../types/project";
import "../styles/project-details.css";

type LoadState = "loading" | "ready" | "not-found" | "error" | "logged-out";

// /projects/{slug}: a project's topics and info, from GET /api/v1/projects/{slug}/
// (api-plan §8.6, §10.3), #168. The endpoint needs a session, so it is only called once the
// session check says the user is logged in; otherwise the user goes to the login page.
function ProjectDetailsPage() {
  const { slug = "" } = useParams();
  const { isAuthenticated, isLoading: isSessionLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    if (isSessionLoading || !isAuthenticated) {
      return;
    }

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
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          // The session expired after the check (§5.6 `not_authenticated`).
          setLoadState("logged-out");
        } else {
          setLoadState(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
        }
      });

    return () => {
      active = false;
    };
  }, [slug, isSessionLoading, isAuthenticated]);

  if (!isSessionLoading && (!isAuthenticated || loadState === "logged-out")) {
    return <Navigate to="/login" replace />;
  }

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
