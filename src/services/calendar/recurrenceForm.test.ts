import {
  buildRRule,
  formatUntil,
  parseRecurrenceForm,
  weekdayOfDate,
  type RecurrenceForm,
  type RuleDateStyle,
} from "./recurrenceForm";

const UTC: RuleDateStyle = { zone: "UTC", isDate: false };
const VIENNA: RuleDateStyle = { zone: "Europe/Vienna", isDate: false };
const ALL_DAY: RuleDateStyle = { zone: null, isDate: true };
const FLOATING: RuleDateStyle = { zone: null, isDate: false };

const form = (overrides: Partial<RecurrenceForm> = {}): RecurrenceForm => ({
  frequency: "weekly",
  interval: 1,
  byDay: [],
  end: { kind: "never" },
  ...overrides,
});

describe("buildRRule", () => {
  it("writes the frequency alone for the simplest rule", () => {
    expect(buildRRule(form({ frequency: "daily" }), UTC)).toBe("FREQ=DAILY");
  });

  it("omits an interval of one and writes anything else", () => {
    expect(buildRRule(form({ interval: 1 }), UTC)).toBe("FREQ=WEEKLY");
    expect(buildRRule(form({ interval: 3 }), UTC)).toBe("FREQ=WEEKLY;INTERVAL=3");
  });

  it("lists weekdays in week order", () => {
    expect(buildRRule(form({ byDay: [5, 1, 3] }), UTC)).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("leaves BYDAY off anything but a weekly rule", () => {
    // On a monthly rule BYDAY selects weekdays of the month, which is not what
    // the day chips in the dialog mean.
    expect(buildRRule(form({ frequency: "monthly", byDay: [1] }), UTC)).toBe("FREQ=MONTHLY");
  });

  it("writes COUNT for a rule that ends after a number of times", () => {
    expect(buildRRule(form({ end: { kind: "count", count: 8 } }), UTC))
      .toBe("FREQ=WEEKLY;COUNT=8");
  });

  it("carries a week start through untouched", () => {
    // WKST changes what INTERVAL means for a weekly rule, so dropping it on a
    // round trip would move instances.
    expect(buildRRule(form({ interval: 2, wkst: "SU" }), UTC))
      .toBe("FREQ=WEEKLY;INTERVAL=2;WKST=SU");
  });
});

describe("buildRRule and the end date", () => {
  it("runs to the last second of the chosen day in the series zone", () => {
    // 23:59:59 on 31 December in Vienna is 22:59:59 UTC, so an instance on the
    // 31st is still inside the series.
    expect(buildRRule(form({ end: { kind: "onDate", date: "2026-12-31" } }), VIENNA))
      .toBe("FREQ=WEEKLY;UNTIL=20261231T225959Z");
  });

  it("writes a bare date for an all-day series", () => {
    // RFC 5545 §3.3.10 ties UNTIL's value type to DTSTART's.
    expect(buildRRule(form({ end: { kind: "onDate", date: "2026-12-31" } }), ALL_DAY))
      .toBe("FREQ=WEEKLY;UNTIL=20261231");
  });

  it("writes local time for a floating series", () => {
    expect(buildRRule(form({ end: { kind: "onDate", date: "2026-12-31" } }), FLOATING))
      .toBe("FREQ=WEEKLY;UNTIL=20261231T235959");
  });

  it("drops an unreadable date rather than writing a broken rule", () => {
    expect(buildRRule(form({ end: { kind: "onDate", date: "" } }), UTC)).toBe("FREQ=WEEKLY");
  });
});

describe("formatUntil", () => {
  const epoch = Math.floor(Date.parse("2027-01-27T22:59:59Z") / 1000);

  it("uses a UTC stamp for a zoned series", () => {
    expect(formatUntil(epoch, VIENNA)).toBe("20270127T225959Z");
  });

  it("uses a bare date for a date-valued series", () => {
    expect(formatUntil(epoch, ALL_DAY)).toMatch(/^\d{8}$/);
  });
});

describe("parseRecurrenceForm", () => {
  it("reports no rule at all", () => {
    expect(parseRecurrenceForm(null).kind).toBe("none");
    expect(parseRecurrenceForm("").kind).toBe("none");
  });

  it("reads back what it wrote", () => {
    const original = form({ frequency: "weekly", interval: 2, byDay: [1, 4] });
    const parsed = parseRecurrenceForm(buildRRule(original, UTC));

    expect(parsed).toEqual({ kind: "simple", form: original });
  });

  it("reads a count", () => {
    const parsed = parseRecurrenceForm("FREQ=MONTHLY;COUNT=6");
    expect(parsed).toEqual({
      kind: "simple",
      form: form({ frequency: "monthly", end: { kind: "count", count: 6 } }),
    });
  });

  it("places a UTC UNTIL on the day the series' own zone sees", () => {
    // 23:59:59 on 31 December in Los Angeles is 1 January in UTC. Reading it as
    // the first would hand the series an extra instance on every save.
    const parsed = parseRecurrenceForm(
      "FREQ=WEEKLY;UNTIL=20270101T075959Z",
      "America/Los_Angeles",
    );

    expect(parsed).toEqual({
      kind: "simple",
      form: form({ end: { kind: "onDate", date: "2026-12-31" } }),
    });
  });

  it("reads a bare date UNTIL as the day it names", () => {
    const parsed = parseRecurrenceForm("FREQ=WEEKLY;UNTIL=20261231");
    expect(parsed).toEqual({
      kind: "simple",
      form: form({ end: { kind: "onDate", date: "2026-12-31" } }),
    });
  });

  it("survives an end date through a full round trip", () => {
    const rule = "FREQ=WEEKLY;UNTIL=20270127T225959Z";
    const parsed = parseRecurrenceForm(rule, "Europe/Vienna");

    expect(parsed.kind).toBe("simple");
    if (parsed.kind !== "simple") return;
    expect(buildRRule(parsed.form, VIENNA)).toBe(rule);
  });
});

describe("parseRecurrenceForm on rules the control cannot state", () => {
  // Every one of these has to come back as "custom": rewriting it from the four
  // frequencies the dialog offers would move instances of a series another
  // client wrote.
  it.each([
    ["an ordinal weekday", "FREQ=MONTHLY;BYDAY=3TH"],
    ["a weekday of the month", "FREQ=MONTHLY;BYDAY=MO"],
    ["a position within the period", "FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1"],
    ["a day of the month", "FREQ=MONTHLY;BYMONTHDAY=15"],
    ["a month filter", "FREQ=YEARLY;BYMONTH=3"],
    ["a sub-daily frequency", "FREQ=HOURLY;INTERVAL=6"],
    ["both a count and an end date", "FREQ=WEEKLY;COUNT=5;UNTIL=20261231T235959Z"],
    ["no frequency at all", "INTERVAL=2"],
    ["a value the parser does not know", "FREQ=WEEKLY;BYWEEKNO=20"],
  ])("keeps %s as it is", (_name, rule) => {
    expect(parseRecurrenceForm(rule).kind).toBe("custom");
  });
});

describe("weekdayOfDate", () => {
  it("names the weekday a date falls on", () => {
    expect(weekdayOfDate("2026-01-05")).toBe(1); // a Monday
    expect(weekdayOfDate("2026-01-11")).toBe(0); // a Sunday
  });

  it("returns null for something that is not a date", () => {
    expect(weekdayOfDate("not a date")).toBeNull();
  });
});
