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
