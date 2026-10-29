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
  // New core: topics and tested items from each project's subject.
  codexion: {
    topics: [
      "Threads",
      "Mutexes",
      "Condition variables",
      "Deadlock prevention",
      "Scheduling (FIFO / EDF)",
      "Priority queue",
      "Burnout monitor",
      "Memory management",
    ],
    tested: [
      "No deadlock or starvation",
      "Burnout logged within 10 ms",
      "Dongle cooldown and fair scheduling",
      "Clean logs, no data races or leaks",
      "Code understanding",
    ],
  },
  "fly-in": {
    topics: [
      "Parsing",
      "Graph modelling",
      "Pathfinding",
      "Zone & link capacity",
      "Turn scheduling",
      "Movement costs",
      "Visualization",
      "Type safety",
    ],
    tested: [
      "Parser and error messages",
      "Turn count against the targets",
      "Capacity rules respected",
      "Algorithm explanation",
      "Code understanding",
    ],
  },
  "rag-against-the-machine": {
    topics: [
      "Chunking",
      "Indexing",
      "BM25 / TF-IDF",
      "Retrieval",
      "Answer generation",
      "Recall@k",
      "CLI (Fire)",
      "Data models (pydantic)",
    ],
    tested: [
      "Recall@5: 80% docs, 50% code",
      "Indexing and search speed",
      "Grounded answers",
      "CLI edge cases",
      "Code understanding",
    ],
  },
  "agent-smith": {
    topics: [
      "Agent loop",
      "Code extraction",
      "Sandbox security",
      "MCP tools",
      "LLM providers",
      "Prompt design",
      "Usage tracking",
      "Benchmarking",
    ],
    tested: [
      "Mandatory tools",
      "Agent reasoning loop",
      "Sandbox isolation",
      "Benchmark report",
      "Live change to the agent",
    ],
  },
  "the-answer-protocol": {
    topics: [
      "TCP server",
      "Protocol compliance",
      "Concurrency",
      "Items & inventory",
      "Combat",
      "Quests",
      "CLI & GUI clients",
      "Server logging",
    ],
    tested: [
      "Every protocol command and event",
      "Multiplayer and disconnects",
      "Combat and quests",
      "Clients interchangeable between groups",
      "Each member's contribution",
    ],
  },
};
