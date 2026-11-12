import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import usePageTitle from "../components/layout/usePageTitle";
import LoadError from "../components/ui/LoadError";
import Skeleton from "../components/ui/Skeleton";
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
  const { t } = useTranslation();
  const { slug = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retryKey, setRetryKey] = useState(0);

  usePageTitle(project?.name ?? t("pageTitle.project"));

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
  }, [slug, retryKey]);

  return (
    <section className="project-details">
      <Link className="project-details__back" to="/">
        <span aria-hidden="true">‹</span> {t("common.backToHome")}
      </Link>

      {loadState === "loading" && (
        <Skeleton
          label={t("project.loading")}
          count={1}
          className="project-details__loading"
          itemClassName="project-details__skeleton"
        />
      )}

      {loadState === "not-found" && (
        <p className="project-details__error" role="alert">
          {t("project.notFound")}
        </p>
      )}

      {loadState === "error" && (
        <LoadError className="project-details__error" onRetry={() => setRetryKey((key) => key + 1)}>
          {t("project.error")}
        </LoadError>
      )}

      {loadState === "ready" && project && (
        <>
          <header className="project-details__header">
            <span className="project-details__badge" aria-hidden="true">
              {projectInitials(project.name)}
            </span>
            <div>
              <h1>{project.name}</h1>
              <p>{t("project.subtitle")}</p>
            </div>
          </header>

          <ProjectOverview project={project} />
        </>
      )}
    </section>
  );
}

export default ProjectDetailsPage;
