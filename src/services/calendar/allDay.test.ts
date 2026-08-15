import { dayAfter, dayRange, lastDayInstant, localDay, toLocalISOString } from "./allDay";

/** Local midnight of a day, the way a stored all-day event holds its ends. */
function midnight(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime() / 1000;
}

describe("dayRange", () => {
  it("leaves a timed event untouched", () => {
    expect(dayRange(false, "2026-09-10T14:30", "2026-09-10T15:30")).toEqual({
      startTime: "2026-09-10T14:30",
      endTime: "2026-09-10T15:30",
    });
  });

  it("ends a one-day all-day event on the following day", () => {
    expect(dayRange(true, "2026-09-10T00:00", "2026-09-10T00:00")).toEqual({
      startTime: "2026-09-10T00:00",
      endTime: "2026-09-11T00:00",
    });
  });

  it("collapses an end that lies before the start to a single day", () => {
    expect(dayRange(true, "2026-09-10", "2026-09-08").endTime).toBe("2026-09-11T00:00");
  });

  it("crosses a year boundary rather than producing a 32nd of December", () => {
    expect(dayRange(true, "2026-12-31", "2026-12-31").endTime).toBe("2027-01-01T00:00");
  });
});

describe("lastDayInstant", () => {
  it("names the day before the exclusive end", () => {
    const start = midnight(2025, 12, 25);
    const end = midnight(2025, 12, 26);

    expect(localDay(lastDayInstant(start, end))).toBe("2025-12-25");
  });

  it("keeps a multi-day event's last day", () => {
    const start = midnight(2025, 12, 25);
    const end = midnight(2025, 12, 28);

    expect(localDay(lastDayInstant(start, end))).toBe("2025-12-27");
  });

  it("does not fall behind the start when the end does not follow it", () => {
    const start = midnight(2025, 12, 25);

    expect(localDay(lastDayInstant(start, start))).toBe("2025-12-25");
  });

  it("reads an end that is not midnight as belonging to the day it names", () => {
    // Rows written before the boundary was settled on end at 23:59:59, and
    // that value does claim the day it falls in.
    const start = midnight(2025, 12, 25);
    const end = midnight(2025, 12, 26) + 86399;

    expect(localDay(lastDayInstant(start, end))).toBe("2025-12-26");
  });
});

describe("localDay and dayAfter", () => {
  it("reads an instant as its local calendar day", () => {
    expect(localDay(midnight(2026, 3, 1))).toBe("2026-03-01");
  });

  it("steps over a month boundary", () => {
    expect(dayAfter("2026-02-28")).toBe("2026-03-01");
  });

  it("leaves something that is not a date alone", () => {
    expect(dayAfter("not-a-date")).toBe("not-a-date");
  });

  it("writes a local date-time the way an input field expects it", () => {
    expect(toLocalISOString(new Date(2026, 8, 10, 14, 5))).toBe("2026-09-10T14:05");
  });
});
