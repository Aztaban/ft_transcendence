import { apiRequest } from "./client";
import type { Paginated } from "../types/pagination";
import type { SCMessage, SCMessageReceipt, SCSenderReveal } from "../types/scMessage";

// api-plan §10.6: a message and the council's note are up to 5000 characters.
export const SC_MESSAGE_MAX_LENGTH = 5000;
export const SC_NOTE_MAX_LENGTH = 5000;

export interface SendSCMessagePayload {
  body: string;
}

// POST /api/v1/sc-messages/ (api-plan §10.6): any logged-in user sends an anonymous message to
// the Student Council. 201 with only `id` and `created_at`. 400 on `body`, 429 `throttled` after
// 10 messages an hour (§5.9).
export function sendSCMessage(payload: SendSCMessagePayload): Promise<SCMessageReceipt> {
  return apiRequest<SCMessageReceipt>("/api/v1/sc-messages/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export interface ListSCMessagesParams {
  // Only messages no council member has read yet.
  unread?: boolean;
  // 1-based page number (§5.7).
  page?: number;
  // Messages per page: 20 by default, at most 100 (§5.7).
  pageSize?: number;
  // Cancels the request, e.g. when a newer one replaces it.
  signal?: AbortSignal;
}

// GET /api/v1/sc-messages/ (api-plan §10.6): SC Members and Admins. Newest first, paginated.
export function listSCMessages({
  unread,
  page,
  pageSize,
  signal,
}: ListSCMessagesParams = {}): Promise<Paginated<SCMessage>> {
  const query = new URLSearchParams();

  if (unread) {
    query.set("unread", "true");
  }

  if (page && page > 1) {
    query.set("page", String(page));
  }

  if (pageSize) {
    query.set("page_size", String(pageSize));
  }

  const search = query.toString();

  return apiRequest<Paginated<SCMessage>>(`/api/v1/sc-messages/${search ? `?${search}` : ""}`, {
    signal,
  });
}

// GET /api/v1/sc-messages/{id}/ (api-plan §10.6): does not change the read state. 404 when the
// message does not exist (or was deleted).
export function getSCMessage(id: number): Promise<SCMessage> {
  return apiRequest<SCMessage>(`/api/v1/sc-messages/${id}/`);
}

function patchSCMessage(id: number, body: Record<string, unknown>): Promise<SCMessage> {
  return apiRequest<SCMessage>(`/api/v1/sc-messages/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// PATCH …/{id}/ with `is_read` (api-plan §10.6): `true` sets `read_at` if it was empty, `false`
// clears it. Needs no version.
export function setSCMessageRead(id: number, isRead: boolean): Promise<SCMessage> {
  return patchSCMessage(id, { is_read: isRead });
}

// PATCH …/{id}/ with the shared note (api-plan §10.6). Saved only if `version` is still the
// current one; otherwise 409 `edit_conflict` and nothing changes: re-fetch, merge, retry.
export function saveSCMessageNote(id: number, note: string, version: number): Promise<SCMessage> {
  return patchSCMessage(id, { discussion_note: note, discussion_note_version: version });
}

// api-plan §10.6: the reason for deleting is 1–500 characters, for revealing the sender 10–500.
export const SC_DELETE_REASON_MAX_LENGTH = 500;
export const SC_REVEAL_REASON_MIN_LENGTH = 10;
export const SC_REVEAL_REASON_MAX_LENGTH = 500;

// DELETE /api/v1/sc-messages/{id}/ (api-plan §10.6): Admins only, to remove abusive content. The
// reason is required and goes into the audit log (`sc_message.deleted`). 204.
export function deleteSCMessage(id: number, reason: string): Promise<void> {
  return apiRequest<void>(`/api/v1/sc-messages/${id}/`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
}

// POST /api/v1/sc-messages/{id}/reveal-sender/ (api-plan §10.6): Admins only, for abuse
// investigations. Every call writes the audit row `sc_message.sender_revealed` with the reason.
export function revealSCMessageSender(id: number, reason: string): Promise<SCSenderReveal> {
  return apiRequest<SCSenderReveal>(`/api/v1/sc-messages/${id}/reveal-sender/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
}
