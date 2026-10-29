import type { UserRole } from "../../types/user";

// Role pills for people search results and public profiles. "Head Tutor" replaces "Hitchhiker"
// (a Head Tutor is also a Hitchhiker), "Student Council" comes on top. Students get no pill.
export function roleBadges(roles: UserRole[]) {
  const names = roles.map((role) => role.name);
  const badges: string[] = [];

  if (names.includes("head_tutor")) {
    badges.push("Head Tutor");
  } else if (names.includes("tutor")) {
    badges.push("Hitchhiker");
  }

  if (names.includes("sc_member")) {
    badges.push("Student Council");
  }

  if (names.includes("admin")) {
    badges.push("Admin");
  }

  return badges;
}

// Hitchhikers (and Head Tutors) evaluate projects (§5.8).
export function isHitchhiker(roles: UserRole[]) {
  return roles.some((role) => role.name === "tutor" || role.name === "head_tutor");
}
