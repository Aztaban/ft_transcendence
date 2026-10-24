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

// POST /api/v1/notifications/{id}/read/ – marks one own notification as read; 200 with the updated
// notification. Idempotent: the first call sets `read_at`, later ones keep it (api-plan §10.5).
export function markNotificationRead(id: number): Promise<Notification> {
  return apiRequest<Notification>(`/api/v1/notifications/${id}/read/`, { method: "POST" });
}

// POST /api/v1/notifications/read-all/ – marks all own notifications as read; 204 (api-plan §10.5).
export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<void>("/api/v1/notifications/read-all/", { method: "POST" });
}
