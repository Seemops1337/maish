import { render, screen } from "@testing-library/react";
import { WeekView } from "./WeekView";
import type { CalendarOccurrence } from "@/services/calendar/occurrences";

function allDayEvent(summary: string, day: Date): CalendarOccurrence {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const startTs = start.getTime() / 1000;
  return {
    id: summary,
    account_id: "a",
    google_event_id: summary,
    summary,
    description: null,
    location: null,
    start_time: startTs,
    end_time: startTs + 86400,
    is_all_day: 1,
    status: "confirmed",
    organizer_email: null,
    attendees_json: null,
    html_link: null,
    updated_at: 0,
    calendar_id: null,
    remote_event_id: null,
    etag: null,
    ical_data: null,
    uid: null,
    rrule: null,
    recurrence_end: null,
    masterId: summary,
    occurrenceId: null,
    isOverride: false,
    isSeriesInstance: false,
  };
}

describe("WeekView", () => {
  // The hour grid scrolls; a scrollbar narrows only the container it sits in.
  // Header and all-day rows must live in that same container, or their
  // columns drift away from the hour grid by the scrollbar's width.
  it("keeps the day header and all-day row in the hour grid's scroll container", () => {
    const date = new Date(2026, 8, 25);
    render(<WeekView currentDate={date} events={[allDayEvent("Holiday", date)]} onEventClick={() => {}} />);

    const allDay = screen.getByText("Holiday");
    const header = screen.getByText("Fri");
    const hourLabel = screen.getByText("9am");

    const scroller = hourLabel.closest(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect(scroller!.contains(header)).toBe(true);
    expect(scroller!.contains(allDay)).toBe(true);
  });
});
