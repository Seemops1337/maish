import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface Preset {
  label: string;
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Optional custom detail string; if omitted, a default date format is used */
  detail?: string;
}

interface DateTimePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  presets: Preset[];
  /** Called with a Unix timestamp in seconds */
  onSelect: (timestamp: number) => void;
  submitLabel: string;
  zIndex?: string;
}

export function DateTimePickerDialog({
  isOpen,
  onClose,
  title,
  presets,
  onSelect,
  submitLabel,
  zIndex,
}: DateTimePickerDialogProps) {
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  const handlePresetClick = (timestamp: number) => {
    onSelect(timestamp);
  };

  const handleCustomSubmit = () => {
    if (!customDate) return;
    const dt = new Date(`${customDate}T${customTime}`);
    onSelect(Math.floor(dt.getTime() / 1000));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} zIndex={zIndex}>
      <div className="p-1">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset.timestamp)}
            className="w-full text-left h-9 px-3 rounded-md text-sm text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-between gap-3"
          >
            <span>{preset.label}</span>
            <span className="font-mono text-xs tabular-nums text-text-tertiary">
              {preset.detail ??
                new Date(preset.timestamp * 1000).toLocaleDateString(
                  undefined,
                  { weekday: "short", month: "short", day: "numeric" },
                )}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-border-primary px-4 py-3 space-y-2 bg-bg-secondary rounded-b-lg">
        <div className="label-mono">
          Custom date & time
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 min-w-0 h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none transition-shadow focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="w-24 h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none transition-shadow focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
        </div>
        <Button
          variant="primary"
          onClick={handleCustomSubmit}
          disabled={!customDate}
          className="w-full"
        >
          {submitLabel}
        </Button>
      </div>
    </Modal>
  );
}
