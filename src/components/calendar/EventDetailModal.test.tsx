import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { EventDetailModal } from "./EventDetailModal";
import { CalendarWriteError } from "@/services/calendar/errors";
import type { CalendarOccurrence } from "@/services/calendar/occurrences";
import type { DbCalendar } from "@/services/db/calendars";

const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockDeleteCalendarEventDb = vi.fn();

vi.mock("@/services/calendar/providerFactory", () => ({
  getCalendarProvider: vi.fn(async () => ({
    updateEvent: mockUpdateEvent,
    deleteEvent: mockDeleteEvent,
  })),
}));

vi.mock("@/services/db/calendarEvents", () => ({
  deleteCalendarEvent: (...args: unknown[]) => mockDeleteCalendarEventDb(...args),
}));

const CALENDAR: DbCalendar = {
  id: "cal-1",
  account_id: "acc-1",
  provider: "caldav",
  remote_id: "/cal/personal/",
  display_name: "Personal",
  color: null,
  is_primary: 1,
  is_visible: 1,
  sync_token: null,
  ctag: null,
  created_at: 0,
  updated_at: 0,
};

const JAN_5 = Math.floor(Date.parse("2026-01-05T09:00:00Z") / 1000);

function makeOccurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: "row-1#" + JAN_5,
    account_id: "acc-1",
    google_event_id: "/cal/personal/series-uid.ics",
    summary: "Weekly",
    description: null,
    location: null,
    start_time: JAN_5,
    end_time: JAN_5 + 3600,
    is_all_day: 0,
    status: "confirmed",
    organizer_email: null,
    attendees_json: null,
    html_link: null,
    updated_at: 0,
    calendar_id: "cal-1",
    remote_event_id: "/cal/personal/series-uid.ics",
    etag: '"old-etag"',
    ical_data: null,
    uid: "series-uid",
    rrule: "FREQ=WEEKLY;COUNT=6",
    recurrence_end: null,
    masterId: "row-1",
    occurrenceId: JAN_5,
    isOverride: false,
    isSeriesInstance: true,
    ...overrides,
  };
}

function renderModal(event = makeOccurrence(), onUpdated = vi.fn()) {
  render(
    <EventDetailModal
      event={event}
      calendars={[CALENDAR]}
      accountId="acc-1"
      onClose={vi.fn()}
      onUpdated={onUpdated}
    />,
  );
  return { onUpdated };
}

describe("EventDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEvent.mockResolvedValue(undefined);
    mockDeleteEvent.mockResolvedValue({ objectRemoved: true });
  });

  describe("a write the server refuses", () => {
    it("reports a conflict instead of closing as if the save had worked", async () => {
      const { onUpdated } = renderModal();
      mockUpdateEvent.mockRejectedValueOnce(
        new CalendarWriteError("Saving the event failed: it changed on the server", 412),
      );

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText(/changed (elsewhere|on the server)/i)).toBeInTheDocument();
      expect(onUpdated).not.toHaveBeenCalled();
    });

    it("reports a failed delete", async () => {
      const { onUpdated } = renderModal();
      mockDeleteEvent.mockRejectedValueOnce(new CalendarWriteError("Deleting the event failed: 401", 401));

      fireEvent.click(screen.getByRole("button", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /all events in the series/i }));

      expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
      expect(onUpdated).not.toHaveBeenCalled();
      expect(mockDeleteCalendarEventDb).not.toHaveBeenCalled();
    });
  });

  describe("deleting part of a series", () => {
    it("keeps the stored row while the calendar object survives", async () => {
      mockDeleteEvent.mockResolvedValueOnce({ objectRemoved: false });
      const { onUpdated } = renderModal();

      fireEvent.click(screen.getByRole("button", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /this and following events/i }));

      await waitFor(() => expect(onUpdated).toHaveBeenCalled());
      expect(mockDeleteCalendarEventDb).not.toHaveBeenCalled();
    });

    it("removes the stored row once the provider removed the object", async () => {
      // Cutting a series before its first instance leaves nothing behind, so
      // the provider deletes the whole object and the row has to follow.
      mockDeleteEvent.mockResolvedValueOnce({ objectRemoved: true });
      const { onUpdated } = renderModal();

      fireEvent.click(screen.getByRole("button", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /this and following events/i }));

      await waitFor(() => expect(onUpdated).toHaveBeenCalled());
      expect(mockDeleteCalendarEventDb).toHaveBeenCalledWith("row-1");
    });
  });
});
