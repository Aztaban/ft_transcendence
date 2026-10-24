import i18n from "../../i18n";
import type { Notification } from "../../types/notification";
import { formatSlot } from "../../utils/dateTime";

// The sentence for a notification in the current language (api-plan §8.8: the backend never sends
// sentences). The key follows the type, e.g. "notifications.evaluation.created", and the text
// reads its values from the payload, e.g. {{project.name}}. Types with a time slot also get
// {{slot}}, in the user's local time.
export function notificationText(notification: Notification): string {
  const { starts_at, ends_at } = notification.payload;
  const slot =
    typeof starts_at === "string" && typeof ends_at === "string"
      ? formatSlot(starts_at, ends_at)
      : "";

  return i18n.t(`notifications.${notification.type}`, { ...notification.payload, slot });
}
