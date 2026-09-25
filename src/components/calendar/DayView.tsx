import { useMemo } from "react";
import type { CalendarOccurrence } from "@/services/calendar/occurrences";

interface DayViewProps {
  currentDate: Date;
  events: CalendarOccurrence[];
  onEventClick: (event: CalendarOccurrence) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView({ currentDate, events, onEventClick }: DayViewProps) {
  const dayStart = new Date(currentDate);
  dayStart.setHours(0, 0, 0, 0);

  // Pre-bucket events by hour (O(E) instead of O(24×E))
  const { hourEvents: hourEventMap, allDayEvents } = useMemo(() => {
    const hMap = new Map<number, CalendarOccurrence[]>();
    const allDay: CalendarOccurrence[] = [];
    const dayTs = dayStart.getTime() / 1000;

    for (const e of events) {
      if (e.is_all_day) {
        allDay.push(e);
      } else {
        for (const hour of HOURS) {
          const hStart = dayTs + hour * 3600;
          const hEnd = hStart + 3600;
          if (e.start_time < hEnd && e.end_time > hStart) {
            const list = hMap.get(hour);
            if (list) list.push(e);
            else hMap.set(hour, [e]);
          }
        }
      }
    }

    return { hourEvents: hMap, allDayEvents: allDay };
  }, [events, dayStart]);
  const isToday = new Date().toDateString() === currentDate.toDateString();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border-primary flex items-center gap-3 shrink-0">
        <div className={`font-mono tabular-nums text-lg font-medium w-9 h-9 flex items-center justify-center rounded-full ${
          isToday ? "bg-accent text-on-accent" : "text-text-primary"
        }`}>
          {currentDate.getDate()}
        </div>
        <div className="label-mono">
          {currentDate.toLocaleDateString(undefined, { weekday: "long" })}
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="px-5 py-2 border-b border-border-primary space-y-1">
          {allDayEvents.map((e) => (
            <button
              key={e.id}
              onClick={() => onEventClick(e)}
              className="w-full text-left text-xs px-2 py-1.5 rounded-sm border-l-2 border-text-tertiary bg-bg-tertiary text-text-primary hover:bg-bg-hover transition-colors"
            >
              {e.summary ?? "Event"} · All day
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const hourEvents = hourEventMap.get(hour) ?? [];
          return (
            <div key={hour} className="flex border-b border-border-primary h-14">
              <div className="w-16 shrink-0 px-2 flex items-start justify-end -mt-1.5">
                <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
                  {hour === 0 ? "" : `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`}
                </span>
              </div>
              <div className="flex-1 relative px-1">
                {hourEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className="w-full text-left text-xs px-2 py-1 rounded-sm border-l-2 border-text-tertiary bg-bg-tertiary text-text-primary truncate hover:bg-bg-hover transition-colors mb-0.5"
                  >
                    {e.summary ?? "Event"}
                    {e.location && <span className="text-text-tertiary"> · {e.location}</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
