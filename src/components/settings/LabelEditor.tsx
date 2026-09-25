import { useState, useEffect, useCallback } from "react";
import { Trash2, Pencil, ChevronUp, ChevronDown, X } from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";
import { useLabelStore, type Label } from "@/stores/labelStore";
import { LabelForm } from "@/components/labels/LabelForm";

export function LabelEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const { labels, loadLabels, deleteLabel, reorderLabels } = useLabelStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeAccountId) {
      loadLabels(activeAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadLabels is a stable store function, only re-run on activeAccountId change
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }, []);

  const handleEdit = useCallback((label: Label) => {
    setEditingId(label.id);
    setShowForm(true);
    setError(null);
  }, []);

  const handleDelete = useCallback(async (label: Label) => {
    if (!activeAccountId) return;
    setError(null);
    try {
      await deleteLabel(activeAccountId, label.id);
      if (editingId === label.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete label");
    }
  }, [activeAccountId, deleteLabel, editingId, resetForm]);

  const handleMoveUp = useCallback(async (index: number) => {
    if (!activeAccountId || index === 0) return;
    const newOrder = labels.map((l) => l.id);
    const a = newOrder[index - 1]!;
    const b = newOrder[index]!;
    newOrder[index - 1] = b;
    newOrder[index] = a;
    await reorderLabels(activeAccountId, newOrder);
  }, [activeAccountId, labels, reorderLabels]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (!activeAccountId || index >= labels.length - 1) return;
    const newOrder = labels.map((l) => l.id);
    const a = newOrder[index]!;
    const b = newOrder[index + 1]!;
    newOrder[index] = b;
    newOrder[index + 1] = a;
    await reorderLabels(activeAccountId, newOrder);
  }, [activeAccountId, labels, reorderLabels]);

  const editingLabel = editingId ? labels.find((l) => l.id === editingId) ?? null : null;

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 border border-danger/20 bg-danger/5 text-danger text-xs rounded-md">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      {labels.length === 0 && !showForm && (
        <p className="text-sm text-text-tertiary">No user labels</p>
      )}

      {labels.length > 0 && (
        <div className="space-y-0.5">
          {labels.map((label, index) => (
            <div key={label.id}>
              <div className="group flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-bg-hover">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {label.colorBg ? (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: label.colorBg }}
                    />
                  ) : (
                    <span className="w-2 h-2 rounded-full shrink-0 bg-text-tertiary/30" />
                  )}
                  <span className="text-sm font-medium text-text-primary truncate">
                    {label.name}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === labels.length - 1}
                    className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => handleEdit(label)}
                    className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(label)}
                    className="p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-bg-hover"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {/* Inline edit form under the label being edited */}
              {showForm && editingId === label.id && activeAccountId && (
                <div className="mt-1">
                  <LabelForm
                    accountId={activeAccountId}
                    label={editingLabel}
                    onDone={resetForm}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New label form at bottom */}
      {showForm && !editingId && activeAccountId ? (
        <LabelForm
          accountId={activeAccountId}
          onDone={resetForm}
        />
      ) : !showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setError(null); }}
          className="inline-flex items-center h-8 px-3 rounded-md border border-border-primary bg-bg-primary text-sm text-text-primary hover:bg-bg-hover transition-colors"
        >
          + Add label
        </button>
      )}
    </div>
  );
}
