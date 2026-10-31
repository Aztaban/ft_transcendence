import i18n, { dateLocale } from "../i18n";

const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

// Formats an evaluation slot in the user's local time, e.g. "Mon, 12 Oct, 17:00–17:45".
export function formatSlot(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const locale = dateLocale();
  const day = start.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return `${day}, ${start.toLocaleTimeString(locale, timeFormat)}–${end.toLocaleTimeString(locale, timeFormat)}`;
}

const timeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

// A calendar date in the chosen language, e.g. "4 July 2026" or "4. července 2026".
export function formatDate(date: string) {
  return new Date(date).toLocaleDateString(dateLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Formats how long ago something happened, e.g. "2 hours ago" or "yesterday".
export function formatTimeAgo(date: string, now = new Date()) {
  const elapsed = new Date(date).getTime() - now.getTime();
  const relativeTime = new Intl.RelativeTimeFormat(dateLocale(), { numeric: "auto" });

  for (const [unit, size] of timeUnits) {
    if (Math.abs(elapsed) >= size) {
      return relativeTime.format(Math.round(elapsed / size), unit);
    }
  }

  return i18n.t("time.justNow");
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Day heading in the user's local time, e.g. "Tomorrow · Tuesday 14 October".
export function formatDayHeading(date: string, now = new Date()) {
  const day = new Date(date);
  const label = day.toLocaleDateString(dateLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const days = Math.round((startOfDay(day) - startOfDay(now)) / DAY);

  if (days === 0) {
    return i18n.t("time.todayHeading", { date: label });
  }

  if (days === 1) {
    return i18n.t("time.tomorrowHeading", { date: label });
  }

  return label;
}

// Time of day in the user's local time, e.g. "09:00".
export function formatTime(date: string) {
  return new Date(date).toLocaleTimeString(dateLocale(), timeFormat);
}

// Length of a slot in minutes, e.g. "45 min".
export function formatDuration(startsAt: string, endsAt: string) {
  return i18n.t("time.minutesShort", {
    count: Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000),
  });
}

function plural(count: number, unit: "days" | "hours" | "minutes") {
  return i18n.t(`time.${unit}`, { count });
}

// How long until a start time, with the two largest units, e.g. "2 days 4 hours".
export function formatStartsIn(startsAt: string, now = new Date()) {
  const minutes = Math.floor((new Date(startsAt).getTime() - now.getTime()) / 60000);

  if (minutes < 1) {
    return i18n.t("time.now");
  }

  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const rest = minutes % 60;

  if (days > 0) {
    return hours > 0 ? `${plural(days, "days")} ${plural(hours, "hours")}` : plural(days, "days");
  }

  if (hours > 0) {
    return rest > 0
      ? `${plural(hours, "hours")} ${plural(rest, "minutes")}`
      : plural(hours, "hours");
  }

  return plural(rest, "minutes");
}
