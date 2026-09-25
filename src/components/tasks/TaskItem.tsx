import { useState, useCallback } from "react";
import {
  Check,
  ChevronRight,
  ChevronDown,
  Trash2,
  Calendar,
  RepeatIcon,
  Link2,
} from "lucide-react";
import type { DbTask, TaskPriority } from "@/services/db/tasks";

/** Checkbox ring per priority: monochrome, state colors only for the top two. */
const PRIORITY_RING: Record<TaskPriority, string> = {
  none: "border-text-tertiary/60",
  low: "border-text-tertiary/60",
  medium: "border-text-secondary",
  high: "border-warning",
  urgent: "border-danger",
};

/** Mono stamp shown before the title; "none" shows nothing. */
const PRIORITY_STAMP: Record<TaskPriority, { label: string; className: string } | null> = {
  none: null,
  low: { label: "Low", className: "text-text-tertiary" },
  medium: { label: "Med", className: "text-text-secondary" },
  high: { label: "High", className: "text-warning" },
  urgent: { label: "Urgent", className: "text-danger" },
};

function formatDueDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDueDateColor(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff < 0) return "text-danger";
  if (diff < 86400) return "text-warning";
  return "text-text-tertiary";
}

interface TaskItemProps {
  task: DbTask;
  subtasks?: DbTask[];
  onToggleComplete: (id: string, completed: boolean) => void;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  isSelected?: boolean;
  compact?: boolean;
}

export function TaskItem({
  task,
  subtasks,
  onToggleComplete,
  onSelect,
  onDelete,
  isSelected,
  compact,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const tags: string[] = (() => {
    try {
      return JSON.parse(task.tags_json) as string[];
    } catch {
      return [];
    }
  })();

  const hasSubtasks = subtasks && subtasks.length > 0;
  const completedSubtasks = subtasks?.filter((s) => s.is_completed).length ?? 0;
  const hasRecurrence = !!task.recurrence_rule;

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(task.id, !task.is_completed);
  }, [task.id, task.is_completed, onToggleComplete]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(task.id);
  }, [task.id, onDelete]);

  return (
    <div>
      <div
        onClick={() => onSelect?.(task.id)}
        className={`group flex items-start gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors ${
          isSelected ? "bg-bg-selected" : "hover:bg-bg-hover"
        }`}
      >
        {/* Checkbox */}
        <button onClick={handleToggle} className="mt-0.5 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/20">
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              task.is_completed
                ? "bg-accent border-accent text-on-accent"
                : `bg-bg-primary ${PRIORITY_RING[task.priority]} hover:bg-bg-hover`
            }`}
          >
            {!!task.is_completed && <Check size={11} strokeWidth={3} />}
          </span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {PRIORITY_STAMP[task.priority] && !task.is_completed && (
              <span className={`label-mono shrink-0 ${PRIORITY_STAMP[task.priority]!.className}`}>
                {PRIORITY_STAMP[task.priority]!.label}
              </span>
            )}
            <span
              className={`text-sm truncate ${
                task.is_completed ? "line-through text-text-tertiary" : "text-text-primary"
              }`}
            >
              {task.title}
            </span>
          </div>

          {!compact && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {task.due_date && (
                <span className={`inline-flex items-center gap-1 font-mono text-[11px] tabular-nums ${getDueDateColor(task.due_date)}`}>
                  <Calendar size={10} />
                  {formatDueDate(task.due_date)}
                </span>
              )}
              {hasRecurrence && (
                <span className="inline-flex items-center gap-0.5 text-text-tertiary">
                  <RepeatIcon size={10} />
                </span>
              )}
              {task.thread_id && (
                <span className="inline-flex items-center gap-0.5 text-text-tertiary">
                  <Link2 size={10} />
                </span>
              )}
              {hasSubtasks && (
                <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                  {completedSubtasks}/{subtasks.length}
                </span>
              )}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border-primary px-1.5 text-[10px] leading-4 text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasSubtasks && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-bg-hover transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div className="ml-6 mt-0.5 space-y-px border-l border-border-primary pl-1">
          {subtasks.map((sub) => (
            <TaskItem
              key={sub.id}
              task={sub}
              onToggleComplete={onToggleComplete}
              onSelect={onSelect}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
