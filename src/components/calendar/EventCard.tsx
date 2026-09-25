import type { CalendarOccurrence } from "@/services/calendar/occurrences";

interface EventCardProps {
  event: CalendarOccurrence;
  compact?: boolean;
  onClick?: () => void;
}

export function EventCard({ event, compact, onClick }: EventCardProps) {
  const startDate = new Date(event.start_time * 1000);
  const timeStr = event.is_all_day
    ? "All day"
    : startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left text-[11px] leading-4 px-1.5 py-0.5 rounded-sm border-l-2 border-text-tertiary bg-bg-tertiary text-text-primary truncate hover:bg-bg-hover transition-colors"
        title={event.summary ?? "Event"}
      >
        {event.summary ?? "Event"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-md border border-border-primary bg-bg-primary hover:bg-bg-hover transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="w-0.5 self-stretch min-h-[24px] rounded-full bg-text-tertiary shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">
            {event.summary ?? "(No title)"}
          </div>
          <div className="font-mono text-xs tabular-nums text-text-tertiary mt-0.5">
            {timeStr}
            {event.location && ` · ${event.location}`}
          </div>
        </div>
      </div>
    </button>
  );
}
