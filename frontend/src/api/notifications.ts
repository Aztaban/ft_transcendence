import { apiRequest } from "./client";
import type { UnreadCount } from "../types/notification";

// GET /api/v1/notifications/unread-count/ – how many of the user's own notifications are unread,
// for the bell badge (api-plan §10.5).
export function getUnreadCount(): Promise<UnreadCount> {
  return apiRequest<UnreadCount>("/api/v1/notifications/unread-count/");
}
