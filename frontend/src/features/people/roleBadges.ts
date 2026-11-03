import type { UserRole } from "../../types/user";

// Role pills for people search results and public profiles, as role names to show with
// `roles.<name>`. "Head Tutor" replaces "Hitchhiker" (a Head Tutor is also a Hitchhiker),
// "Student Council" comes on top. Students get no pill.
export function roleBadges(roles: UserRole[]) {
  const names = roles.map((role) => role.name);
  const badges: UserRole["name"][] = [];

  if (names.includes("head_tutor")) {
    badges.push("head_tutor");
  } else if (names.includes("tutor")) {
    badges.push("tutor");
  }

  if (names.includes("sc_member")) {
    badges.push("sc_member");
  }

  if (names.includes("admin")) {
    badges.push("admin");
  }

  return badges;
}

// Hitchhikers (and Head Tutors) evaluate projects (§5.8).
export function isHitchhiker(roles: UserRole[]) {
  return roles.some((role) => role.name === "tutor" || role.name === "head_tutor");
}
