import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import type { DbCalendar } from "@/services/db/calendars";
import type { RecurrenceForm } from "@/services/calendar/recurrenceForm";
import { dayRange, toLocalISOString } from "@/services/calendar/allDay";
import { RecurrenceField } from "./RecurrenceField";

interface EventCreateModalProps {
  calendars?: DbCalendar[];
  onClose: () => void;
  onCreate: (event: {
    summary: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    calendarId?: string;
    recurrence: RecurrenceForm | null;
  }) => void;
}

export function EventCreateModal({ calendars, onClose, onCreate }: EventCreateModalProps) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState(getDefaultStart());
  const [endTime, setEndTime] = useState(getDefaultEnd());
  const [allDay, setAllDay] = useState(false);
  const [calendarId, setCalendarId] = useState<string>(
    calendars?.find((c) => c.is_primary)?.id ?? calendars?.[0]?.id ?? "",
  );
  const [recurrence, setRecurrence] = useState<RecurrenceForm | null>(null);

  const startDate = startTime.slice(0, 10);
  const endDate = endTime.slice(0, 10);

  // The time of day is kept while the switch is on, so turning it off again
  // brings back the hours the event started out with rather than midnight.
  const setStartDate = useCallback((date: string) => {
    setStartTime((current) => `${date}T${current.slice(11)}`);
    // The end follows a start that moves past it. Left behind it would be a
    // range no server takes, and the dialog would have to refuse to save
    // instead of showing something sensible.
    setEndTime((current) => (current.slice(0, 10) < date ? `${date}T${current.slice(11)}` : current));
  }, []);

  const setEndDate = useCallback((date: string) => {
    setEndTime((current) => `${date}T${current.slice(11)}`);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    onCreate({
      summary: summary.trim(),
      description,
      location,
      ...dayRange(allDay, startTime, endTime),
      isAllDay: allDay,
      calendarId: calendarId || undefined,
      recurrence,
    });
  }, [summary, description, location, startTime, endTime, allDay, calendarId, recurrence, onCreate]);

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Event" width="w-full max-w-md">
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <TextField
          label="Title"
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Event title"
          autoFocus
        />

        {calendars && calendars.length > 1 && (
          <div>
            <label className="text-xs text-text-secondary block mb-1">Calendar</label>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent"
            >
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.display_name ?? "Calendar"}
                  {cal.is_primary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="rounded accent-[var(--color-accent)]"
          />
          All day
        </label>

        <div className="grid grid-cols-2 gap-3">
          {allDay ? (
            <>
              <TextField
                label="Start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <TextField
                label="End"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          ) : (
            <>
              <TextField
                label="Start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <TextField
                label="End"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </>
          )}
        </div>

        <RecurrenceField
          value={recurrence}
          onChange={setRecurrence}
          startDate={startDate}
        />

        <TextField
          label="Location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location"
        />

        <div>
          <label className="text-xs text-text-secondary block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description"
            rows={3}
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!summary.trim()}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function getDefaultStart(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return toLocalISOString(now);
}

function getDefaultEnd(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 2);
  return toLocalISOString(now);
}
