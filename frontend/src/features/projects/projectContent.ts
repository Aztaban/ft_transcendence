// Descriptive content for the project page (Figma "Upcoming Evaluation Details").
// It is not part of the API: `Project` only has id, slug, name and eligible_tutors (api-plan §8.6).
// The team decided to keep it in the frontend, since topics almost never change (IT Architect,
// 2026-10-14); add or fix projects here.
// The topics and the "what will be tested" lines are user-facing text, so they live in the locale
// files under `projectContent.<slug>` (EN, CS, ES). This file keeps what is not text. A project
// without texts shows "Topics for this project haven't been added yet."

import i18n from "../../i18n";
import { topicIcon } from "./topicIcons";

export interface ProjectContent {
  durationMinutes?: number;
  subjectUrl?: string;
}

export const projectContent: Record<string, ProjectContent> = {
  push_swap: { durationMinutes: 45 },
  born2beroot: {},
  minishell: {},
  cpp09: {},
  codexion: {},
  "fly-in": {},
  "rag-against-the-machine": {},
  "agent-smith": {},
  "the-answer-protocol": {},
};

export interface ProjectTopic {
  label: string;
  // The chart icon, picked from the English name, so it is the same in every language.
  icon: string;
}

export interface ProjectTexts {
  topics: ProjectTopic[];
  tested: string[];
}

// The topics and tested items of a project in the current language, or null when the project
// has none yet.
export function projectTexts(slug: string): ProjectTexts | null {
  const key = `projectContent.${slug}`;

  if (!i18n.exists(`${key}.topics`)) {
    return null;
  }

  const labels = i18n.t(`${key}.topics`, { returnObjects: true }) as string[];
  const english = i18n.t(`${key}.topics`, { lng: "en", returnObjects: true }) as string[];

  return {
    topics: labels.map((label, index) => ({ label, icon: topicIcon(english[index] ?? label) })),
    tested: i18n.t(`${key}.tested`, { returnObjects: true }) as string[],
  };
}
