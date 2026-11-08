import { apiRequest } from "./client";
import type { AdminUser, UserStatus } from "../types/adminUser";
import type { Paginated } from "../types/pagination";
import type { RoleName } from "../types/user";

export interface ListAdminUsersParams {
  // Matched case-insensitively against the email, display name and 42 login.
  q?: string;
  role?: RoleName;
  status?: UserStatus;
  // 1-based page number (§5.7).
  page?: number;
}

// GET /api/v1/admin/users/ (api-plan §10.2), Admin only, paginated (§5.7), ordered by display
// name. Only the filters that have a value are sent: an empty one is 400 `validation_error`.
export function listAdminUsers(params: ListAdminUsersParams = {}): Promise<Paginated<AdminUser>> {
  const query = new URLSearchParams();

  if (params.q) {
    query.set("q", params.q);
  }

  if (params.role) {
    query.set("role", params.role);
  }

  if (params.status) {
    query.set("status", params.status);
  }

  if (params.page && params.page > 1) {
    query.set("page", String(params.page));
  }

  const search = query.toString();

  return apiRequest<Paginated<AdminUser>>(`/api/v1/admin/users/${search ? `?${search}` : ""}`);
}
