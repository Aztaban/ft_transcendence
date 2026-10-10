// Shapes from docs/api-plan.md §8.1 and §8.6.

export interface UserRef {
  id: number;
  display_name: string;
  avatar_url: string | null;
}

export interface ProjectRef {
  id: number;
  slug: string;
  name: string;
}

export interface Project extends ProjectRef {
  eligible_tutors: UserRef[];
}
