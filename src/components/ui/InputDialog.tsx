import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface InputField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  title: string;
  fields: InputField[];
  submitLabel?: string;
}

export function InputDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  fields,
  submitLabel = "Save",
}: InputDialogProps) {
  const buildInitial = useCallback(
    () =>
      Object.fromEntries(
        fields.map((f) => [f.key, f.defaultValue ?? ""]),
      ),
    [fields],
  );

  const [values, setValues] = useState<Record<string, string>>(buildInitial);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset values when the dialog opens or fields change
  useEffect(() => {
    if (isOpen) {
      setValues(buildInitial());
      const id = setTimeout(() => firstInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen, buildInitial]);

  const isValid = fields.every((f) => {
    const required = f.required ?? true;
    return !required || values[f.key]?.trim();
  });

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit(values);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && fields.length === 1 && isValid) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="w-96">
      <div onKeyDown={handleKeyDown}>
        <div className="p-4 space-y-3">
        {fields.map((field, i) => (
          <div key={field.key}>
            <label className="label-mono block mb-1.5">
              {field.label}
            </label>
            <input
              ref={i === 0 ? firstInputRef : undefined}
              type="text"
              value={values[field.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              placeholder={field.placeholder}
              className="w-full h-8 bg-bg-primary text-text-primary text-sm px-3 rounded-md border border-border-primary outline-none transition-shadow focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10 placeholder:text-text-tertiary"
            />
          </div>
        ))}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-primary bg-bg-secondary rounded-b-lg">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!isValid}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
