import { useMemo } from "react";
import type { CalendarOccurrence } from "@/services/calendar/occurrences";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarOccurrence[];
  onEventClick: (event: CalendarOccurrence) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekView({ currentDate, events, onEventClick }: WeekViewProps) {
  const weekStart = new Date(currentDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();
  const todayStr = today.toDateString();

  // Pre-bucket events by day+hour and all-day per day (O(E) instead of O(168×E))
  const { dayHourEvents, allDayByDay } = useMemo(() => {
    const dhMap = new Map<string, CalendarOccurrence[]>();
    const adMap = new Map<number, CalendarOccurrence[]>();

    for (const day of days) {
      const dayTs = day.getTime() / 1000;
      const dayKey = day.getDate();

      for (const e of events) {
        if (e.is_all_day) {
          const dayEnd = dayTs + 86400;
          if (e.start_time < dayEnd && e.end_time > dayTs) {
            const list = adMap.get(dayKey);
            if (list) list.push(e);
            else adMap.set(dayKey, [e]);
          }
        } else {
          for (const hour of HOURS) {
            const hStart = dayTs + hour * 3600;
            const hEnd = hStart + 3600;
            if (e.start_time < hEnd && e.end_time > hStart) {
              const key = `${dayKey}-${hour}`;
              const list = dhMap.get(key);
              if (list) list.push(e);
              else dhMap.set(key, [e]);
            }
          }
        }
      }
    }

    return { dayHourEvents: dhMap, allDayByDay: adMap };
  }, [events, days]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* One scroll container for header, all-day row and hour grid, so a
          scrollbar narrows all three alike and their columns stay aligned */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-bg-primary">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border-primary">
            <div className="border-r border-border-primary" />
            {days.map((day, i) => {
              const isToday = day.toDateString() === todayStr;
              return (
                <div key={i} className="px-2 py-2 text-center border-r border-border-primary">
                  <div className="label-mono">{DAY_NAMES[day.getDay()]}</div>
                  <div className={`font-mono tabular-nums text-sm font-medium mt-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${
                    isToday ? "bg-accent text-on-accent" : "text-text-primary"
                  }`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-day events row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border-primary">
            <div className="border-r border-border-primary px-1 py-1 font-mono text-[10px] text-text-tertiary text-right">all-day</div>
            {days.map((day, i) => {
              const allDay = allDayByDay.get(day.getDate()) ?? [];
              return (
                <div key={i} className="border-r border-border-primary px-1 py-1 space-y-0.5">
                  {allDay.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onEventClick(e)}
                      className="w-full text-left text-[11px] leading-4 px-1.5 py-0.5 rounded-sm border-l-2 border-text-tertiary bg-bg-tertiary text-text-primary truncate hover:bg-bg-hover transition-colors"
                    >
                      {e.summary ?? "Event"}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-r border-b border-border-primary h-12 px-1 flex items-start justify-end">
                <span className="font-mono text-[10px] tabular-nums text-text-tertiary -mt-1.5">
                  {hour === 0 ? "" : `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`}
                </span>
              </div>
              {days.map((day, di) => {
                const hourEvents = dayHourEvents.get(`${day.getDate()}-${hour}`) ?? [];
                return (
                  <div key={di} className="border-r border-b border-border-primary h-12 relative px-0.5">
                    {hourEvents.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => onEventClick(e)}
                        className="absolute inset-x-0.5 text-left text-[11px] leading-4 px-1.5 py-0.5 rounded-sm border-l-2 border-text-tertiary bg-bg-tertiary text-text-primary truncate hover:bg-bg-hover transition-colors"
                        title={e.summary ?? "Event"}
                      >
                        {e.summary ?? "Event"}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
