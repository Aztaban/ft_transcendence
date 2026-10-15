// Line icons (24×24, stroke only) for the topics chart, picked from the topic's name.

const ICONS = {
  code: "M8 6 2 12l6 6M16 6l6 6-6 6",
  shield: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3zM12 8v5M12 16v.5",
  chip: "M7 7h10v10H7zM10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3",
  database:
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  arrows: "M4 8h15l-4-4M20 16H5l4 4",
  chart: "M5 20v-5M11 20v-8M17 20V9M4 11l6-5 4 3 6-5",
  document: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6",
  users:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7M22 21c0-3-1.5-5-4-5.5",
  algorithm:
    "M12 2v5M12 17v5M2 12h5M17 12h5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3",
  sparkle: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
};

const KEYWORDS: [RegExp, keyof typeof ICONS][] = [
  [/algorithm/i, "algorithm"],
  [/code|builtin|syntax/i, "code"],
  [/error|exception|firewall|password|sudo|security/i, "shield"],
  [/memory|virtual/i, "chip"],
  [/stack|container|stl|partition|lvm|environment/i, "database"],
  [/operation|pipe|redirect|ssh|signal/i, "arrows"],
  [/optimi|complexity|monitor|sort/i, "chart"],
  [/pars|input|quote|expansion/i, "document"],
  [/user|group/i, "users"],
];

export function topicIcon(topic: string): string {
  const match = KEYWORDS.find(([pattern]) => pattern.test(topic));

  return ICONS[match ? match[1] : "sparkle"];
}
