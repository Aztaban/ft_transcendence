import { apiRequest } from "./client";
import type { AdminUser, UserStatus } from "../types/adminUser";
import type { EvaluationException } from "../types/evaluation";
import type { Paginated } from "../types/pagination";
import type { Language, RoleName } from "../types/user";

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

// GET /api/v1/admin/users/{id}/ (api-plan §10.2), Admin only. Deleted accounts are included;
// 404 `not_found` for an unknown id.
export function getAdminUser(id: number): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/api/v1/admin/users/${id}/`);
}

// The fields an Admin may change (api-plan §10.2); only the ones sent are changed.
export interface UpdateAdminUserPayload {
  display_name?: string;
  email?: string;
  language?: Language;
}

// PATCH /api/v1/admin/users/{id}/ (api-plan §10.2): returns the updated AdminUser. 409
// `email_already_exists` when another account has the email, 409 `invalid_user_status` for a
// deleted account, 400 `validation_error` with `fields` for invalid values.
export function updateAdminUser(id: number, payload: UpdateAdminUserPayload): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/api/v1/admin/users/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// api-plan §10.2: suspend, reactivate and delete need a `reason` of 1–500 characters (trimmed),
// kept in the audit log. A blank one is 400 `validation_error` with `fields.reason`.
export const REASON_MAX_LENGTH = 500;

function reasonRequest(method: "POST" | "DELETE", reason: string): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  };
}

// POST /api/v1/admin/users/{id}/suspend/ (api-plan §10.2): ends the user's sessions and returns
// the AdminUser. 409 `invalid_user_status` unless the account is active, 409 `cannot_modify_self`.
export function suspendAdminUser(id: number, reason: string): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/api/v1/admin/users/${id}/suspend/`, reasonRequest("POST", reason));
}

// POST /api/v1/admin/users/{id}/reactivate/ (api-plan §10.2): undoes a suspension and returns the
// AdminUser. 409 `invalid_user_status` unless the account is suspended, 409 `cannot_modify_self`.
export function reactivateAdminUser(id: number, reason: string): Promise<AdminUser> {
  return apiRequest<AdminUser>(
    `/api/v1/admin/users/${id}/reactivate/`,
    reasonRequest("POST", reason),
  );
}

// DELETE /api/v1/admin/users/{id}/ (api-plan §10.2): anonymizes the account for good (schema
// §2.4), 204 with no body. 409 `invalid_user_status` if it is already deleted, 409
// `cannot_modify_self`.
export function deleteAdminUser(id: number, reason: string): Promise<void> {
  return apiRequest<void>(`/api/v1/admin/users/${id}/`, reasonRequest("DELETE", reason));
}

// GET /api/v1/admin/evaluation-requests/exceptions/ (api-plan §10.9), Head Tutors and Admins:
// the requests that need a human decision, newest first, paginated (§5.7). No filters.
export function listEvaluationExceptions(page = 1): Promise<Paginated<EvaluationException>> {
  const search = page > 1 ? `?page=${page}` : "";

  return apiRequest<Paginated<EvaluationException>>(
    `/api/v1/admin/evaluation-requests/exceptions/${search}`,
  );
}
