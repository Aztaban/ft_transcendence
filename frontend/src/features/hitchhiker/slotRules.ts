// Slot rules for pick-slot, from docs/api-plan.md §7.1. The backend keeps them as settings
// (EVALUATION_SLOT_*); these values must match the defaults there.
export const MIN_LEAD_MINUTES = 30;
export const MAX_DAYS_AHEAD = 14;
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
export const DEFAULT_DURATION = 45;
export const SLOT_MINUTES = [0, 15, 30, 45];
export const SLOT_HOURS = Array.from({ length: 13 }, (_, index) => 8 + index); // 08:00–20:00

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// Today and the following days, at local midnight, as long as a slot can still start in them.
export function upcomingDays(now: Date): Date[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Array.from(
    { length: MAX_DAYS_AHEAD },
    (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + index),
  );
}

export function slotStart(day: Date, hour: number, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
}

export function slotEnd(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * MINUTE);
}

// A start must be at least 30 minutes and at most 14 days in the future.
export function isStartAllowed(start: Date, now: Date): boolean {
  const lead = start.getTime() - now.getTime();

  return lead >= MIN_LEAD_MINUTES * MINUTE && lead <= MAX_DAYS_AHEAD * DAY;
}
