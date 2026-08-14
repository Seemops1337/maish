import {
  editMaster,
  editOccurrence,
  excludeOccurrence,
  masterRule,
  splitSeriesFrom,
  truncateSeriesBefore,
} from "./icalEdit";
import { expandOccurrences } from "./recurrence";

/** The same shape a real server returns: zone definition, rule, alarm. */
const VIENNA_SERIES = [
  "BEGIN:VCALENDAR",
  "CALSCALE:GREGORIAN",
  "PRODID:-//Apple Inc.//macOS 26.6.1//EN",
  "VERSION:2.0",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Vienna",
  "BEGIN:DAYLIGHT",
  "DTSTART:19810329T020000",
  "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "DTSTART:19961027T030000",
  "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "CREATED:20260810T181247Z",
  "DTEND;TZID=Europe/Vienna:20260930T220000",
  "DTSTAMP:20260811T065817Z",
  "DTSTART;TZID=Europe/Vienna:20260930T180000",
  "RRULE:FREQ=WEEKLY;UNTIL=20270127T225959Z",
  "SEQUENCE:0",
  "SUMMARY:Englisch BFI",
  "TRANSP:OPAQUE",
  "UID:7CAE5FE8-6C1F-4487-BAD2-C4B1EF2DE6E5",
  "BEGIN:VALARM",
  "ACTION:NONE",
  "TRIGGER;VALUE=DATE-TIME:19760401T005545Z",
  "END:VALARM",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** 2026-10-21 18:00 and 2026-10-28 18:00 Vienna, either side of the DST change. */
const OCT_21 = ts("2026-10-21T16:00:00Z");
const OCT_28 = ts("2026-10-28T17:00:00Z");

const OCTOBER: [number, number] = [
  ts("2026-10-01T00:00:00Z"),
  ts("2026-11-01T00:00:00Z"),
];

const startsIn = (ical: string, range: [number, number] = OCTOBER) =>
  expandOccurrences(ical, range[0], range[1]).map((o) => o.startTime);

describe("editMaster", () => {
  it("keeps the recurrence rule, time zone and alarm intact", () => {
    const edited = editMaster(VIENNA_SERIES, { summary: "Englisch, neu" });

    expect(edited).toContain("RRULE:FREQ=WEEKLY;UNTIL=20270127T225959Z");
    expect(edited).toContain("BEGIN:VTIMEZONE");
    expect(edited).toContain("TZID:Europe/Vienna");
    expect(edited).toContain("BEGIN:VALARM");
    expect(edited).toContain("TRANSP:OPAQUE");
    expect(edited).toContain("SUMMARY:Englisch\\, neu");
  });

  it("leaves the series expanding exactly as before", () => {
    const edited = editMaster(VIENNA_SERIES, { summary: "Renamed" });

    expect(startsIn(edited)).toEqual(startsIn(VIENNA_SERIES));
    expect(expandOccurrences(edited, OCTOBER[0], OCTOBER[1])[0]!.summary).toBe("Renamed");
  });

  it("writes a new start in the original zone rather than in UTC", () => {
    // Rewriting DTSTART as UTC would silently detach the series from
    // Europe/Vienna, so every instance after a DST change would shift an hour.
    const edited = editMaster(VIENNA_SERIES, {
      startTime: ts("2026-09-30T17:00:00Z"),
      endTime: ts("2026-09-30T19:00:00Z"),
    });

    expect(edited).toContain("DTSTART;TZID=Europe/Vienna:20260930T190000");
    expect(edited).toContain("DTEND;TZID=Europe/Vienna:20260930T210000");

    // 19:00 local on both sides of the transition, an hour apart in UTC.
    expect(startsIn(edited)).toEqual([
      ts("2026-10-07T17:00:00Z"),
      ts("2026-10-14T17:00:00Z"),
      ts("2026-10-21T17:00:00Z"),
      ts("2026-10-28T18:00:00Z"),
    ]);
  });

  it("bumps SEQUENCE so the server sees a newer revision", () => {
    expect(editMaster(VIENNA_SERIES, { summary: "x" })).toContain("SEQUENCE:1");
  });

  it("removes a property that is cleared", () => {
    const withLocation = editMaster(VIENNA_SERIES, { location: "Room 3" });
    expect(withLocation).toContain("LOCATION:Room 3");

    const cleared = editMaster(withLocation, { location: "" });
    expect(cleared).not.toContain("LOCATION:");
  });

  it("folds lines longer than 75 octets", () => {
    const edited = editMaster(VIENNA_SERIES, { description: "x".repeat(200) });

    for (const line of edited.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("editOccurrence", () => {
  it("moves one instance and leaves the rest alone", () => {
    const edited = editOccurrence(VIENNA_SERIES, OCT_21, {
      startTime: ts("2026-10-21T18:00:00Z"),
      endTime: ts("2026-10-21T20:00:00Z"),
      summary: "Moved this week only",
    });

    expect(startsIn(edited)).toEqual([
      ts("2026-10-07T16:00:00Z"),
      ts("2026-10-14T16:00:00Z"),
      ts("2026-10-21T18:00:00Z"),
      OCT_28,
    ]);

    const occurrences = expandOccurrences(edited, OCTOBER[0], OCTOBER[1]);
    expect(occurrences[2]!.summary).toBe("Moved this week only");
    expect(occurrences[2]!.isOverride).toBe(true);
    expect(occurrences[3]!.summary).toBe("Englisch BFI");
    expect(occurrences[3]!.isOverride).toBe(false);
  });

  it("writes a RECURRENCE-ID in the series' own zone", () => {
    const edited = editOccurrence(VIENNA_SERIES, OCT_21, { summary: "x" });

    expect(edited).toContain("RECURRENCE-ID;TZID=Europe/Vienna:20261021T180000");
  });

  it("reuses the master's UID for the override", () => {
    const edited = editOccurrence(VIENNA_SERIES, OCT_21, { summary: "x" });
    const uids = edited.split("\r\n").filter((l) => l.startsWith("UID:"));

    expect(uids).toHaveLength(2);
    expect(uids[0]).toBe(uids[1]);
  });

  it("updates the existing override instead of adding a second one", () => {
    const once = editOccurrence(VIENNA_SERIES, OCT_21, { summary: "First" });
    const twice = editOccurrence(once, OCT_21, { summary: "Second" });

    expect(twice.split("BEGIN:VEVENT")).toHaveLength(3);
    expect(twice).toContain("SUMMARY:Second");
    expect(twice).not.toContain("SUMMARY:First");
    expect(startsIn(twice)).toHaveLength(4);
  });

  it("keeps the master's rule untouched", () => {
    const edited = editOccurrence(VIENNA_SERIES, OCT_21, { summary: "x" });

    expect(masterRule(edited)).toBe("FREQ=WEEKLY;UNTIL=20270127T225959Z");
  });
});

describe("excludeOccurrence", () => {
  it("removes exactly one instance", () => {
    const edited = excludeOccurrence(VIENNA_SERIES, OCT_21);

    expect(edited).toContain("EXDATE;TZID=Europe/Vienna:20261021T180000");
    expect(startsIn(edited)).toEqual([
      ts("2026-10-07T16:00:00Z"),
      ts("2026-10-14T16:00:00Z"),
      OCT_28,
    ]);
  });

  it("also drops an override the instance had", () => {
    const moved = editOccurrence(VIENNA_SERIES, OCT_21, {
      startTime: ts("2026-10-21T18:00:00Z"),
      endTime: ts("2026-10-21T19:00:00Z"),
    });
    const removed = excludeOccurrence(moved, OCT_21);

    expect(removed.split("BEGIN:VEVENT")).toHaveLength(2);
    expect(startsIn(removed)).toEqual([
      ts("2026-10-07T16:00:00Z"),
      ts("2026-10-14T16:00:00Z"),
      OCT_28,
    ]);
  });

  it("accumulates across repeated deletions", () => {
    const edited = excludeOccurrence(excludeOccurrence(VIENNA_SERIES, OCT_21), OCT_28);

    expect(startsIn(edited)).toEqual([
      ts("2026-10-07T16:00:00Z"),
      ts("2026-10-14T16:00:00Z"),
    ]);
  });
});

describe("truncateSeriesBefore", () => {
  it("ends the series just before the given instance", () => {
    const edited = truncateSeriesBefore(VIENNA_SERIES, OCT_21);

    expect(startsIn(edited)).toEqual([
      ts("2026-10-07T16:00:00Z"),
      ts("2026-10-14T16:00:00Z"),
    ]);
  });

  it("replaces COUNT with UNTIL, since a rule may not carry both", () => {
    const counted = VIENNA_SERIES.replace(
      "RRULE:FREQ=WEEKLY;UNTIL=20270127T225959Z",
      "RRULE:FREQ=WEEKLY;COUNT=20",
    );

    const edited = truncateSeriesBefore(counted, OCT_21);
    const rule = masterRule(edited)!;

    expect(rule).not.toContain("COUNT");
    expect(rule).toContain("UNTIL=");
    expect(startsIn(edited)).toHaveLength(2);
  });

  it("drops overrides that belonged to the removed tail", () => {
    const moved = editOccurrence(VIENNA_SERIES, OCT_28, { summary: "Later" });
    const edited = truncateSeriesBefore(moved, OCT_21);

    expect(edited).not.toContain("SUMMARY:Later");
    expect(startsIn(edited)).toHaveLength(2);
  });
});

describe("splitSeriesFrom", () => {
  it("carries the tail of the series into a new object", () => {
    const tail = splitSeriesFrom(VIENNA_SERIES, OCT_21, "new-uid-1", {
      summary: "Second half",
    });

    expect(tail).toContain("UID:new-uid-1");
    expect(tail).toContain("SUMMARY:Second half");
    expect(tail).toContain("DTSTART;TZID=Europe/Vienna:20261021T180000");
    expect(startsIn(tail)).toEqual([OCT_21, OCT_28]);
  });

  it("keeps the original duration when only the title changes", () => {
    const tail = splitSeriesFrom(VIENNA_SERIES, OCT_21, "new-uid-2", { summary: "x" });
    const first = expandOccurrences(tail, OCTOBER[0], OCTOBER[1])[0]!;

    expect(first.endTime - first.startTime).toBe(4 * 3600);
  });

  it("together with truncation splits the series in two without gaps or overlaps", () => {
    const head = truncateSeriesBefore(VIENNA_SERIES, OCT_21);
    const tail = splitSeriesFrom(VIENNA_SERIES, OCT_21, "new-uid-3", { summary: "Renamed" });

    expect([...startsIn(head), ...startsIn(tail)]).toEqual(startsIn(VIENNA_SERIES));
  });

  it("takes the instances the head keeps out of a COUNT-bounded tail", () => {
    // COUNT is relative to the rule's own start, so carrying it over unchanged
    // makes the two halves add up to more instances than the original had.
    const counted = VIENNA_SERIES.replace(
      "RRULE:FREQ=WEEKLY;UNTIL=20270127T225959Z",
      "RRULE:FREQ=WEEKLY;COUNT=10",
    );
    const window: [number, number] = [ts("2026-09-01T00:00:00Z"), ts("2027-03-01T00:00:00Z")];

    const head = truncateSeriesBefore(counted, OCT_21);
    const tail = splitSeriesFrom(counted, OCT_21, "new-uid-5", {});

    expect(masterRule(tail)).toContain("COUNT=7");
    expect([...startsIn(head, window), ...startsIn(tail, window)])
      .toEqual(startsIn(counted, window));
  });

  it("keeps the alarm and time zone in the new object", () => {
    const tail = splitSeriesFrom(VIENNA_SERIES, OCT_21, "new-uid-4", {});

    expect(tail).toContain("BEGIN:VTIMEZONE");
    expect(tail).toContain("BEGIN:VALARM");
    expect(tail).toContain("SEQUENCE:0");
  });
});
