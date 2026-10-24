import i18n from "../../i18n";
import type { Notification, NotificationType } from "../../types/notification";
import { formatSlot } from "../../utils/dateTime";

// Types whose sentence depends on a status value: the payload field that picks the variant,
// e.g. result "passed" → "notifications.evaluation.result_recorded_passed" (i18next context).
const contextField: Partial<Record<NotificationType, string>> = {
  "evaluation.expired": "previous_status",
  "evaluation.result_recorded": "result",
  "eligibility.decided": "decision",
};

// The sentence for a notification in the current language (api-plan §8.8: the backend never sends
// sentences). The key follows the type, e.g. "notifications.evaluation.created", and the text
// reads its values from the payload, e.g. {{project.name}}. Types with a time slot also get
// {{slot}}, in the user's local time, and status values pick their own sentence instead of being
// shown raw.
export function notificationText(notification: Notification): string {
  const { starts_at, ends_at } = notification.payload;
  const field = contextField[notification.type];
  const value = field ? notification.payload[field] : undefined;
  const context = typeof value === "string" ? value : undefined;
  const slot =
    typeof starts_at === "string" && typeof ends_at === "string"
      ? formatSlot(starts_at, ends_at)
      : "";

  return i18n.t(`notifications.${notification.type}`, { ...notification.payload, slot, context });
}
