import { apiRequest } from "./client";
import type { AuditAction, AuditEntry, AuditTargetType } from "../types/audit";
import type { Paginated } from "../types/pagination";

export interface ListAuditLogParams {
  // User id of the account that acted.
  actor?: number;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: number;
  // ISO 8601 datetimes with a time zone (the API refuses them without one).
  from?: string;
  to?: string;
  // 1-based page number (§5.7).
  page?: number;
}

// GET /api/v1/admin/audit-log/ (api-plan §10.9): Admins only, newest first, paginated (§5.7).
// 400 `validation_error` on a bad filter, 403 for anyone else.
export function listAuditLog(params: ListAuditLogParams = {}): Promise<Paginated<AuditEntry>> {
  const query = new URLSearchParams();

  if (params.actor) {
    query.set("actor", String(params.actor));
  }

  if (params.action) {
    query.set("action", params.action);
  }

  if (params.targetType) {
    query.set("target_type", params.targetType);
  }

  if (params.targetId) {
    query.set("target_id", String(params.targetId));
  }

  if (params.from) {
    query.set("from", params.from);
  }

  if (params.to) {
    query.set("to", params.to);
  }

  if (params.page && params.page > 1) {
    query.set("page", String(params.page));
  }

  const search = query.toString();

  return apiRequest<Paginated<AuditEntry>>(`/api/v1/admin/audit-log/${search ? `?${search}` : ""}`);
}
