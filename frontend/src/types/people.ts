// Shapes from docs/api-plan.md §8.3 (PublicUser) and §10.8 (people search).
import type { ProjectRef } from "./project";
import type { UserRole } from "./user";

export interface PublicUser {
  id: number;
  display_name: string;
  avatar_url: string | null;
  roles: UserRole[];
}

// A people search result: a PublicUser plus the projects a Hitchhiker can evaluate (empty for
// everyone else).
export interface PersonResult extends PublicUser {
  eligible_projects: ProjectRef[];
}
