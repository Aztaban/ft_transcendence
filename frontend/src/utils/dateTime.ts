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

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Day heading in the user's local time, e.g. "Tomorrow · Tuesday 14 October".
export function formatDayHeading(date: string, now = new Date()) {
  const day = new Date(date);
  const label = day.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const days = Math.round((startOfDay(day) - startOfDay(now)) / DAY);

  if (days === 0) {
    return `Today · ${label}`;
  }

  if (days === 1) {
    return `Tomorrow · ${label}`;
  }

  return label;
}

// Time of day in the user's local time, e.g. "09:00".
export function formatTime(date: string) {
  return new Date(date).toLocaleTimeString(undefined, timeFormat);
}

// Length of a slot in minutes, e.g. "45 min".
export function formatDuration(startsAt: string, endsAt: string) {
  return `${Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)} min`;
}

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

// How long until a start time, with the two largest units, e.g. "2 days 4 hours".
export function formatStartsIn(startsAt: string, now = new Date()) {
  const minutes = Math.floor((new Date(startsAt).getTime() - now.getTime()) / 60000);

  if (minutes < 1) {
    return "now";
  }

  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const rest = minutes % 60;

  if (days > 0) {
    return hours > 0 ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
  }

  if (hours > 0) {
    return rest > 0 ? `${plural(hours, "hour")} ${plural(rest, "minute")}` : plural(hours, "hour");
  }

  return plural(rest, "minute");
}
