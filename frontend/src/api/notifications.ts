import { apiRequest } from "./client";
import type { Notification, UnreadCount } from "../types/notification";
import type { Paginated } from "../types/pagination";

// GET /api/v1/notifications/unread-count/ – how many of the user's own notifications are unread,
// for the bell badge (api-plan §10.5).
export function getUnreadCount(): Promise<UnreadCount> {
  return apiRequest<UnreadCount>("/api/v1/notifications/unread-count/");
}

// GET /api/v1/notifications/ – the user's own notifications, newest first, 20 per page
// (api-plan §10.5, §5.7).
export function listNotifications(page = 1): Promise<Paginated<Notification>> {
  return apiRequest<Paginated<Notification>>(
    page > 1 ? `/api/v1/notifications/?page=${page}` : "/api/v1/notifications/",
  );
}
