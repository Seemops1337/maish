import { useCallback } from "react";
import {
  DEFAULT_RECURRENCE,
  weekdayOfDate,
  type RecurrenceForm,
  type RepeatEnd,
  type RepeatFrequency,
} from "@/services/calendar/recurrenceForm";

/**
 * The repeat control shared by the create and edit dialogs.
 *
 * `customRule` is the description of a rule the control cannot state — an
 * ordinal weekday, a BYSETPOS, anything richer than the four frequencies here.
 * Such a rule is shown but not edited: replacing it takes a deliberate click,
 * because rewriting it would move every instance of the series.
 */
interface RecurrenceFieldProps {
  value: RecurrenceForm | null;
  onChange: (value: RecurrenceForm | null) => void;
  /** Start date of the event as YYYY-MM-DD, for sensible defaults. */
  startDate: string;
  /** Description of a stored rule too complex for this control, if any. */
  customRule?: string | null;
  /** Why the control is not editable right now; shown in place of a hint. */
  disabledReason?: string;
}

const FREQUENCY_OPTIONS: { value: RepeatFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const UNIT_LABELS: Record<RepeatFrequency, [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  yearly: ["year", "years"],
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const SELECT_CLASS =
  "px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm " +
  "text-text-primary outline-none focus:border-accent disabled:opacity-50";

export function RecurrenceField({
  value,
  onChange,
  startDate,
  customRule,
  disabledReason,
}: RecurrenceFieldProps) {
  const disabled = Boolean(disabledReason);

  const patch = useCallback((changes: Partial<RecurrenceForm>) => {
    if (!value) return;
    onChange({ ...value, ...changes });
  }, [value, onChange]);

  const handleFrequency = useCallback((next: string) => {
    if (next === "none") {
      onChange(null);
      return;
    }
    const frequency = next as RepeatFrequency;
    onChange({ ...(value ?? DEFAULT_RECURRENCE), frequency });
  }, [value, onChange]);

  const toggleWeekday = useCallback((day: number) => {
    if (!value) return;
    const byDay = value.byDay.includes(day)
      ? value.byDay.filter((d) => d !== day)
      : [...value.byDay, day].sort((a, b) => a - b);
    onChange({ ...value, byDay });
  }, [value, onChange]);

  const handleEndKind = useCallback((kind: RepeatEnd["kind"]) => {
    if (!value) return;
    if (kind === "count") patch({ end: { kind: "count", count: 10 } });
    else if (kind === "onDate") patch({ end: { kind: "onDate", date: defaultEndDate(startDate) } });
    else patch({ end: { kind: "never" } });
  }, [value, patch, startDate]);

  if (customRule) {
    return (
      <div className="border-t border-border-primary pt-3">
        <div className="text-xs text-text-secondary mb-1">Repeat</div>
        <p className="text-sm text-text-secondary">{customRule}</p>
        <p className="text-xs text-text-tertiary mt-1">
          This rule is more detailed than the options here, so it is kept as it is.
        </p>
        {!disabled && (
          <div className="flex gap-3 mt-1.5">
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() => onChange({ ...DEFAULT_RECURRENCE, ...seedWeekly(startDate) })}
            >
              Replace with a simple rule
            </button>
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() => onChange(null)}
            >
              Remove repetition
            </button>
          </div>
        )}
        {disabledReason && (
          <p className="text-xs text-text-tertiary mt-1">{disabledReason}</p>
        )}
      </div>
    );
  }

  const units = value ? UNIT_LABELS[value.frequency] : UNIT_LABELS.weekly;

  return (
    <div className="border-t border-border-primary pt-3 space-y-2">
      <div>
        <label htmlFor="recurrence-frequency" className="text-xs text-text-secondary block mb-1">
          Repeat
        </label>
        <select
          id="recurrence-frequency"
          value={value?.frequency ?? "none"}
          disabled={disabled}
          onChange={(e) => handleFrequency(e.target.value)}
          className={`w-full ${SELECT_CLASS}`}
        >
          <option value="none">Does not repeat</option>
          {FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {value && (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="recurrence-interval" className="text-xs text-text-secondary">
              Every
            </label>
            <input
              id="recurrence-interval"
              type="number"
              min={1}
              max={999}
              value={value.interval}
              disabled={disabled}
              onChange={(e) => patch({ interval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className={`w-16 ${SELECT_CLASS}`}
            />
            <span className="text-xs text-text-secondary">
              {value.interval === 1 ? units[0] : units[1]}
            </span>
          </div>

          {value.frequency === "weekly" && (
            <fieldset disabled={disabled}>
              <legend className="text-xs text-text-secondary mb-1">On</legend>
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = value.byDay.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      aria-label={WEEKDAY_NAMES[day]}
                      onClick={() => toggleWeekday(day)}
                      className={`w-7 h-7 rounded-full text-xs border transition-colors ${
                        active
                          ? "bg-accent text-white border-accent"
                          : "bg-bg-tertiary text-text-secondary border-border-primary hover:bg-bg-hover"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {value.byDay.length === 0 && (
                <p className="text-xs text-text-tertiary mt-1">
                  Follows the day the event starts on.
                </p>
              )}
            </fieldset>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="recurrence-end" className="text-xs text-text-secondary">
              Ends
            </label>
            <select
              id="recurrence-end"
              value={value.end.kind}
              disabled={disabled}
              onChange={(e) => handleEndKind(e.target.value as RepeatEnd["kind"])}
              className={SELECT_CLASS}
            >
              <option value="never">Never</option>
              <option value="count">After a number of times</option>
              <option value="onDate">On a date</option>
            </select>

            {value.end.kind === "count" && (
              <input
                type="number"
                min={1}
                max={999}
                aria-label="Number of times"
                value={value.end.count}
                disabled={disabled}
                onChange={(e) => patch({
                  end: { kind: "count", count: Math.max(1, parseInt(e.target.value, 10) || 1) },
                })}
                className={`w-16 ${SELECT_CLASS}`}
              />
            )}

            {value.end.kind === "onDate" && (
              <input
                type="date"
                aria-label="Last date"
                value={value.end.date}
                disabled={disabled}
                onChange={(e) => patch({ end: { kind: "onDate", date: e.target.value } })}
                className={SELECT_CLASS}
              />
            )}
          </div>
        </>
      )}

      {disabledReason && <p className="text-xs text-text-tertiary">{disabledReason}</p>}
    </div>
  );
}

/** A weekly rule starts out on the day the event itself falls on. */
function seedWeekly(startDate: string): Partial<RecurrenceForm> {
  const weekday = weekdayOfDate(startDate);
  return weekday === null ? {} : { byDay: [weekday] };
}

/** Roughly three months out, so the date picker opens somewhere useful. */
function defaultEndDate(startDate: string): string {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  const base = parsed
    ? new Date(Date.UTC(+parsed[1]!, +parsed[2]! - 1, +parsed[3]!))
    : new Date();
  base.setUTCMonth(base.getUTCMonth() + 3);
  return base.toISOString().slice(0, 10);
}
