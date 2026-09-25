import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";

export type CalendarView = "day" | "week" | "month";

interface CalendarToolbarProps {
  currentDate: Date;
  view: CalendarView;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onCreateEvent: () => void;
  onToggleCalendarList?: () => void;
  showCalendarListButton?: boolean;
}

export function CalendarToolbar({
  currentDate,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onCreateEvent,
  onToggleCalendarList,
  showCalendarListButton,
}: CalendarToolbarProps) {
  const title = formatTitle(currentDate, view);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3 bg-bg-primary border-b border-border-primary">
      {/* Navigation comes before the title so a longer month name cannot push
          the buttons sideways and move the click targets between views. */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onPrev}
            aria-label={`Previous ${view}`}
            title={`Previous ${view}`}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onToday}
            className="h-7 px-2.5 mx-0.5 rounded-md border border-border-primary bg-bg-primary text-xs font-medium text-text-primary hover:bg-bg-hover transition-colors"
          >
            Today
          </button>
          <button
            onClick={onNext}
            aria-label={`Next ${view}`}
            title={`Next ${view}`}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <h2 className="min-w-0 text-lg font-medium tracking-tight text-text-primary truncate">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showCalendarListButton && onToggleCalendarList && (
          <button
            onClick={onToggleCalendarList}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Toggle calendar list"
          >
            <CalendarDays size={16} />
          </button>
        )}
        <div className="flex bg-bg-tertiary rounded-md p-0.5">
          {(["day", "week", "month"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`h-7 px-3 text-xs font-medium rounded transition-colors capitalize ${
                view === v
                  ? "bg-bg-primary text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          onClick={onCreateEvent}
          className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors"
        >
          <Plus size={14} />
          Create
        </button>
      </div>
    </div>
  );
}

function formatTitle(date: Date, view: CalendarView): string {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (view === "month") {
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (view === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    if (start.getMonth() === end.getMonth()) {
      return `${months[start.getMonth()]} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${months[start.getMonth()]?.slice(0, 3)} ${start.getDate()} - ${months[end.getMonth()]?.slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
