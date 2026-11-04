import { describe, expect, it } from "vitest";

import type { RoleName, UserRole } from "../../types/user";
import { assignableRoles, canRevokeRoles } from "./roleRules";

function roles(...names: RoleName[]): UserRole[] {
  return names.map((name, index) => ({ id: index + 1, name }));
}

describe("assignableRoles", () => {
  it("lets an Admin give tutor, head_tutor and sc_member", () => {
    expect(assignableRoles(roles("student", "admin"))).toEqual([
      "tutor",
      "head_tutor",
      "sc_member",
    ]);
  });

  it("lets a Head Tutor give tutor only", () => {
    expect(assignableRoles(roles("student", "head_tutor"))).toEqual(["tutor"]);
  });

  it("lets an SC Member give sc_member only", () => {
    expect(assignableRoles(roles("student", "sc_member"))).toEqual(["sc_member"]);
  });

  it("combines the roles of a Head Tutor who is also an SC Member", () => {
    expect(assignableRoles(roles("student", "head_tutor", "sc_member"))).toEqual([
      "tutor",
      "sc_member",
    ]);
  });

  it("offers each role once to an Admin who also holds other roles", () => {
    expect(assignableRoles(roles("student", "admin", "head_tutor", "sc_member"))).toEqual([
      "tutor",
      "head_tutor",
      "sc_member",
    ]);
  });

  it("gives nothing to students and Hitchhikers", () => {
    expect(assignableRoles(roles("student"))).toEqual([]);
    expect(assignableRoles(roles("student", "tutor"))).toEqual([]);
  });
});

describe("canRevokeRoles", () => {
  it("is true only for an Admin", () => {
    expect(canRevokeRoles(roles("student", "admin"))).toBe(true);
    expect(canRevokeRoles(roles("student", "head_tutor", "sc_member"))).toBe(false);
    expect(canRevokeRoles(roles("student"))).toBe(false);
  });
});
