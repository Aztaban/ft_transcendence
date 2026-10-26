import { apiRequest } from "./client";
import type { SCMessageReceipt } from "../types/scMessage";

// api-plan §10.6: a message is 1–5000 characters.
export const SC_MESSAGE_MAX_LENGTH = 5000;

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
