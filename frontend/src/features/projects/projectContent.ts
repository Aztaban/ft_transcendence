// Descriptive content for the project page (Figma "Upcoming Evaluation Details").
// It is not part of the API: `Project` only has id, slug, name and eligible_tutors (api-plan §8.6).
// The team decided to keep it in the frontend, since topics almost never change (IT Architect,
// 2026-10-14); add or fix projects here.
// Projects without an entry show "Topics for this project haven't been added yet."

export interface ProjectContent {
  topics: string[];
  tested: string[];
  durationMinutes?: number;
  subjectUrl?: string;
}

export const projectContent: Record<string, ProjectContent> = {
  push_swap: {
    durationMinutes: 45,
    topics: [
      "Algorithms",
      "Parsing",
      "Stacks",
      "Operations",
      "Move optimization",
      "Error handling",
      "Memory management",
      "Code quality",
    ],
    tested: ["Algorithm choice", "Code understanding", "Error handling", "Project constraints"],
  },
  born2beroot: {
    topics: [
      "Virtualization",
      "Partitions & LVM",
      "Users & groups",
      "Password policy",
      "SSH",
      "Firewall",
      "Sudo",
      "Monitoring script",
    ],
    tested: [
      "Virtual machine setup",
      "Security configuration",
      "Monitoring script",
      "Understanding of the system",
    ],
  },
  minishell: {
    topics: [
      "Parsing",
      "Quotes & expansion",
      "Pipes",
      "Redirections",
      "Builtins",
      "Signals",
      "Environment",
      "Memory management",
    ],
    tested: ["Command execution", "Edge cases", "Error handling", "Code understanding"],
  },
  cpp09: {
    topics: [
      "STL containers",
      "Algorithms",
      "Input parsing",
      "Exceptions",
      "Sorting",
      "Complexity",
    ],
    tested: [
      "Choice of containers",
      "Algorithm correctness",
      "Error handling",
      "Code understanding",
    ],
  },
};
