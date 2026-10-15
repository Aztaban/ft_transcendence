const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

// Formats an evaluation slot in the user's local time, e.g. "Mon, 12 Oct, 17:00–17:45".
export function formatSlot(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return `${day}, ${start.toLocaleTimeString(undefined, timeFormat)}–${end.toLocaleTimeString(undefined, timeFormat)}`;
}

// English until i18n is set up (#305), like the rest of the UI text.
const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const timeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

// Formats how long ago something happened, e.g. "2 hours ago" or "yesterday".
export function formatTimeAgo(date: string, now = new Date()) {
  const elapsed = new Date(date).getTime() - now.getTime();

  for (const [unit, size] of timeUnits) {
    if (Math.abs(elapsed) >= size) {
      return relativeTime.format(Math.round(elapsed / size), unit);
    }
  }

  return "just now";
}
