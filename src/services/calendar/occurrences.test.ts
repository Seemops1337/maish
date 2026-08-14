import { expandRows, rowRecurs } from "./occurrences";
import type { DbCalendarEvent } from "@/services/db/calendarEvents";

const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);

const WEEKLY = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:weekly-1",
  "SUMMARY:Standup",
  "DTSTART:20260105T090000Z",
  "DTEND:20260105T093000Z",
  "RRULE:FREQ=WEEKLY;COUNT=4",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function makeRow(overrides: Partial<DbCalendarEvent> = {}): DbCalendarEvent {
  return {
    id: "row-1",
    account_id: "acc-1",
    google_event_id: "https://dav.example/cal/weekly-1.ics",
    summary: "Standup",
    description: null,
    location: null,
    start_time: ts("2026-01-05T09:00:00Z"),
    end_time: ts("2026-01-05T09:30:00Z"),
    is_all_day: 0,
    status: "confirmed",
    organizer_email: null,
    attendees_json: null,
    html_link: null,
    updated_at: 0,
    calendar_id: "cal-1",
    remote_event_id: "https://dav.example/cal/weekly-1.ics",
    etag: "etag-1",
    ical_data: null,
    uid: "weekly-1",
    rrule: null,
    recurrence_end: null,
    ...overrides,
  };
}

const JANUARY: [number, number] = [
  ts("2026-01-01T00:00:00Z"),
  ts("2026-02-01T00:00:00Z"),
];

describe("rowRecurs", () => {
  it("is false for a plain event", () => {
    expect(rowRecurs(makeRow())).toBe(false);
  });

  it("is true once a rule is stored", () => {
    expect(rowRecurs(makeRow({ rrule: "FREQ=WEEKLY" }))).toBe(true);
  });
});

describe("expandRows", () => {
  it("passes a non-recurring row straight through", () => {
    const row = makeRow();
    const result = expandRows([row], JANUARY[0], JANUARY[1]);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("row-1");
    expect(result[0]!.masterId).toBe("row-1");
    expect(result[0]!.isSeriesInstance).toBe(false);
    expect(result[0]!.occurrenceId).toBeNull();
  });

  it("drops a non-recurring row that misses the range", () => {
    const row = makeRow({
      start_time: ts("2026-05-01T09:00:00Z"),
      end_time: ts("2026-05-01T10:00:00Z"),
    });

    expect(expandRows([row], JANUARY[0], JANUARY[1])).toHaveLength(0);
  });

  it("expands one stored row into every instance in range", () => {
    const row = makeRow({
      ical_data: WEEKLY,
      rrule: "FREQ=WEEKLY;COUNT=4",
      recurrence_end: ts("2026-01-26T09:30:00Z"),
    });

    const result = expandRows([row], JANUARY[0], JANUARY[1]);

    expect(result.map((o) => o.start_time)).toEqual([
      ts("2026-01-05T09:00:00Z"),
      ts("2026-01-12T09:00:00Z"),
      ts("2026-01-19T09:00:00Z"),
      ts("2026-01-26T09:00:00Z"),
    ]);
    expect(result.every((o) => o.isSeriesInstance)).toBe(true);
  });

  it("gives every instance a distinct id but keeps the master's row id", () => {
    const row = makeRow({
      ical_data: WEEKLY,
      rrule: "FREQ=WEEKLY;COUNT=4",
      recurrence_end: ts("2026-01-26T09:30:00Z"),
    });

    const result = expandRows([row], JANUARY[0], JANUARY[1]);
    const ids = result.map((o) => o.id);

    expect(new Set(ids).size).toBe(result.length);
    expect(result.every((o) => o.masterId === "row-1")).toBe(true);
    expect(result.every((o) => o.etag === "etag-1")).toBe(true);
    expect(result.every((o) => o.remote_event_id === row.remote_event_id)).toBe(true);
  });

  it("shows only the instances inside the window", () => {
    const row = makeRow({
      ical_data: WEEKLY,
      rrule: "FREQ=WEEKLY;COUNT=4",
      recurrence_end: ts("2026-01-26T09:30:00Z"),
    });

    const result = expandRows(
      [row],
      ts("2026-01-11T00:00:00Z"),
      ts("2026-01-18T00:00:00Z"),
    );

    expect(result.map((o) => o.start_time)).toEqual([ts("2026-01-12T09:00:00Z")]);
  });

  it("returns occurrences from several rows in time order", () => {
    const series = makeRow({
      ical_data: WEEKLY,
      rrule: "FREQ=WEEKLY;COUNT=4",
      recurrence_end: ts("2026-01-26T09:30:00Z"),
    });
    const single = makeRow({
      id: "row-2",
      summary: "One off",
      start_time: ts("2026-01-14T09:00:00Z"),
      end_time: ts("2026-01-14T10:00:00Z"),
    });

    const result = expandRows([series, single], JANUARY[0], JANUARY[1]);

    expect(result.map((o) => o.summary)).toEqual([
      "Standup", "Standup", "One off", "Standup", "Standup",
    ]);
  });

  it("falls back to the stored row when the rule cannot be read", () => {
    const row = makeRow({
      ical_data: "this is not a calendar object",
      rrule: "FREQ=NONSENSE",
      recurrence_end: null,
    });

    const result = expandRows([row], JANUARY[0], JANUARY[1]);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("row-1");
    expect(result[0]!.isSeriesInstance).toBe(false);
  });
});
