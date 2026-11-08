import { useTranslation } from "react-i18next";

import type { ProjectRef } from "../../types/project";
import { projectContent, projectTexts } from "./projectContent";
import TopicsChart from "./TopicsChart";
import "../../styles/project-details.css";

interface ProjectOverviewProps {
  project: ProjectRef;
}

// "minishell" → "MI", "RAG against the machine" → "RA"
export function projectInitials(name: string) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

// The project's topics, info and what will be tested (Figma
// "Upcoming Evaluation Details"). Shared by /projects/{slug} (#168) and the scheduled
// evaluation preview. Duration and subject come from projectContent.ts, the topics and tested
// items from the locale files, in the current language.
function ProjectOverview({ project }: ProjectOverviewProps) {
  const { t } = useTranslation();
  const content = projectContent[project.slug];
  // Read on every render, so a language switch shows the texts in the new language.
  const texts = projectTexts(project.slug);
  const id = (part: string) => `project-${project.slug}-${part}`;

  return (
    <div className="project-details__overview">
      <section className="project-details__card project-details__card--chart">
        {texts ? (
          <TopicsChart projectName={project.name} topics={texts.topics} />
        ) : (
          <p className="project-details__empty">{t("project.noTopics")}</p>
        )}
      </section>

      <div className="project-details__grid">
        <section className="project-details__card" aria-labelledby={id("info")}>
          <h2 id={id("info")}>{t("project.info")}</h2>
          <dl className="project-details__info">
            {content?.durationMinutes && (
              <div>
                <dt>{t("project.estimatedDuration")}</dt>
                <dd>{t("time.minutesShort", { count: content.durationMinutes })}</dd>
              </div>
            )}
            <div>
              <dt>{t("project.onCampus")}</dt>
              <dd>42 Prague</dd>
            </div>
            <div>
              <dt>{t("project.evaluatedBy")}</dt>
              <dd>{t("project.evaluatedByValue")}</dd>
            </div>
          </dl>
          {content?.subjectUrl && (
            <a
              className="project-details__subject"
              href={content.subjectUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("project.subject")} <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>

        <section
          className="project-details__card project-details__card--tested"
          aria-labelledby={id("tested")}
        >
          <h2 id={id("tested")}>{t("project.tested")}</h2>
          {texts ? (
            <ul className="project-details__tested">
              {texts.tested.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="project-details__empty">{t("project.notAdded")}</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default ProjectOverview;
