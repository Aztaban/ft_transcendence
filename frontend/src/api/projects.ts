import { apiRequest } from "./client";
import type { Project, ProjectRef } from "../types/project";

// GET /api/v1/projects/ – active projects sorted by name, not paginated (api-plan §10.3).
export function listProjects(): Promise<ProjectRef[]> {
  return apiRequest<ProjectRef[]>("/api/v1/projects/");
}

// GET /api/v1/projects/{slug}/ – 404 for inactive or unknown projects.
export function getProject(slug: string): Promise<Project> {
  return apiRequest<Project>(`/api/v1/projects/${encodeURIComponent(slug)}/`);
}
