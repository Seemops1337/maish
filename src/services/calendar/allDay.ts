/**
 * The two ends of an all-day event, as a dialog shows them and as a provider
 * is handed them.
 *
 * An all-day event ends on the day *after* its last one: RFC 5545 §3.6.1 makes
 * DTEND exclusive for DATE values, and the Google API documents `end.date` the
 * same way. A dialog, though, asks for and shows the day the event ends on,
 * which is the day a reader would name. Both directions of that translation
 * live here so the create and edit dialogs cannot drift apart.
 */

/** A local date-time in the form an `<input type="datetime-local">` uses. */
export function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The local calendar day an instant falls in, as `YYYY-MM-DD`. */
export function localDay(epochSeconds: number): string {
  return toLocalISOString(new Date(epochSeconds * 1000)).slice(0, 10);
}

/** The day after the given one, crossing month and year boundaries. */
export function dayAfter(date: string): string {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parsed) return date;
  return toLocalISOString(new Date(+parsed[1]!, +parsed[2]! - 1, +parsed[3]! + 1)).slice(0, 10);
}

/**
 * An instant inside the last day a stored event covers.
 *
 * The stored range is half-open, so the last covered day is the one holding
 * the moment just before the end. Reading it that way rather than subtracting
 * a day also keeps an end that is not exactly midnight — anything written
 * before the exclusive boundary was settled on — pointing at the day it names.
 */
export function lastDayInstant(startTime: number, endTime: number): number {
  return Math.max(startTime, endTime - 1);
}

/**
 * The start and end a provider is handed. For an all-day event the chosen last
 * day is carried forward by one, so the range ends where the specifications
 * say it should. An end before the start collapses to a single day rather than
 * a range no server would accept.
 */
export function dayRange(
  allDay: boolean,
  startTime: string,
  endTime: string,
): { startTime: string; endTime: string } {
  if (!allDay) return { startTime, endTime };

  const start = startTime.slice(0, 10);
  const picked = endTime.slice(0, 10);
  const last = picked < start ? start : picked;

  // Handed on as local date-times: a bare date string parses as UTC, which is
  // the day before west of Greenwich once it is read back as a local day.
  return { startTime: `${start}T00:00`, endTime: `${dayAfter(last)}T00:00` };
}
