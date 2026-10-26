import { apiRequest } from "./client";
import type { Paginated } from "../types/pagination";
import type { PersonResult } from "../types/people";

// `tutor` also matches Head Tutors (§10.8).
export type PeopleSearchRole = "tutor" | "head_tutor" | "sc_member";

export type PeopleOrdering = "display_name" | "-display_name";

export interface SearchPeopleParams {
  // 2–64 characters, matched against the display name (and the 42 login, never returned).
  q?: string;
  role?: PeopleSearchRole;
  // Project slug: only Hitchhikers eligible for it.
  project?: string;
  ordering?: PeopleOrdering;
  // 1-based page number (§5.7).
  page?: number;
}

// GET /api/v1/search/people/ (api-plan §10.8), paginated (§5.7). 429 `throttled` past 60 searches
// a minute (§5.9).
export function searchPeople(params: SearchPeopleParams = {}): Promise<Paginated<PersonResult>> {
  const query = new URLSearchParams();

  if (params.q) {
    query.set("q", params.q);
  }

  if (params.role) {
    query.set("role", params.role);
  }

  if (params.project) {
    query.set("project", params.project);
  }

  if (params.ordering) {
    query.set("ordering", params.ordering);
  }

  if (params.page && params.page > 1) {
    query.set("page", String(params.page));
  }

  const search = query.toString();

  return apiRequest<Paginated<PersonResult>>(`/api/v1/search/people/${search ? `?${search}` : ""}`);
}

// How many people hold a role, for the page overview: the `count` of the first page (§5.7).
export function countPeople(role: PeopleSearchRole): Promise<number> {
  return searchPeople({ role }).then((result) => result.count);
}
