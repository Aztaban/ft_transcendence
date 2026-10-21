import { useMemo, useState } from "react";

import {
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  SLOT_HOURS,
  SLOT_MINUTES,
  isStartAllowed,
  slotEnd,
  slotStart,
  upcomingDays,
} from "./slotRules";

export interface ChosenSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

// Messages from a 400 `validation_error`, shown under the control they are about.
export interface SlotFieldErrors {
  start?: string;
  duration?: string;
}

interface SlotPickerProps {
  // Refreshed by the page while it stays open, so starts that became too soon are disabled.
  now: Date;
  onChange: (slot: ChosenSlot | null) => void;
  errors?: SlotFieldErrors;
}

interface Choice {
  // The chosen day at local midnight. Kept as a date, not a position in the list, because the
  // list moves on when the day changes while the page is open.
  day: Date;
  hour: number | null;
  minute: number | null;
  duration: number;
}

function dayLabel(day: Date, index: number) {
  if (index === 0) {
    return "Today";
  }

  if (index === 1) {
    return "Tomorrow";
  }

  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

// Day, start time (15-minute steps) and duration for POST …/pick-slot/ (api-plan §7.1).
function SlotPicker({ now, onChange, errors = {} }: SlotPickerProps) {
  const days = useMemo(() => upcomingDays(now), [now]);
  const [choice, setChoice] = useState<Choice>(() => ({
    day: upcomingDays(now)[0],
    hour: null,
    minute: null,
    duration: DEFAULT_DURATION,
  }));

  const day = choice.day;

  function update(patch: Partial<Choice>) {
    const next = { ...choice, ...patch };

    setChoice(next);

    if (next.hour === null || next.minute === null) {
      onChange(null);
      return;
    }

    const start = slotStart(next.day, next.hour, next.minute);

    onChange(
      isStartAllowed(start, now)
        ? { start, end: slotEnd(start, next.duration), durationMinutes: next.duration }
        : null,
    );
  }

  const hourAllowed = (hour: number) =>
    SLOT_MINUTES.some((minute) => isStartAllowed(slotStart(day, hour, minute), now));

  return (
    <div className="slot-picker">
      <fieldset className="slot-picker__group">
        <legend>Day</legend>
        <div className="slot-picker__options slot-picker__options--scroll">
          {days.map((option, index) => (
            <button
              className="slot-picker__option"
              type="button"
              key={option.toISOString()}
              aria-pressed={choice.day.getTime() === option.getTime()}
              disabled={
                !SLOT_HOURS.some((hour) =>
                  SLOT_MINUTES.some((minute) =>
                    isStartAllowed(slotStart(option, hour, minute), now),
                  ),
                )
              }
              onClick={() => update({ day: option, hour: null, minute: null })}
            >
              {dayLabel(option, index)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset
        className={`slot-picker__group${errors.start ? " slot-picker__group--error" : ""}`}
        aria-describedby={errors.start ? "slot-start-error" : undefined}
      >
        <legend>Start time</legend>
        <div className="slot-picker__options">
          {SLOT_HOURS.map((hour) => (
            <button
              className="slot-picker__option"
              type="button"
              key={hour}
              aria-pressed={choice.hour === hour}
              disabled={!hourAllowed(hour)}
              onClick={() => update({ hour, minute: null })}
            >
              {twoDigits(hour)}:00
            </button>
          ))}
        </div>

        {choice.hour !== null && (
          <div className="slot-picker__options slot-picker__options--minutes">
            {SLOT_MINUTES.map((minute) => (
              <button
                className="slot-picker__option"
                type="button"
                key={minute}
                aria-pressed={choice.minute === minute}
                disabled={!isStartAllowed(slotStart(day, choice.hour as number, minute), now)}
                onClick={() => update({ minute })}
              >
                {twoDigits(choice.hour as number)}:{twoDigits(minute)}
              </button>
            ))}
          </div>
        )}

        {errors.start && (
          <p id="slot-start-error" className="slot-picker__error">
            {errors.start}
          </p>
        )}
      </fieldset>

      <fieldset
        className={`slot-picker__group${errors.duration ? " slot-picker__group--error" : ""}`}
        aria-describedby={errors.duration ? "slot-duration-error" : undefined}
      >
        <legend>Duration</legend>
        <div className="slot-picker__options">
          {DURATION_OPTIONS.map((duration) => (
            <button
              className="slot-picker__option"
              type="button"
              key={duration}
              aria-pressed={choice.duration === duration}
              onClick={() => update({ duration })}
            >
              {duration} min
            </button>
          ))}
        </div>

        {errors.duration && (
          <p id="slot-duration-error" className="slot-picker__error">
            {errors.duration}
          </p>
        )}
      </fieldset>
    </div>
  );
}

export default SlotPicker;
