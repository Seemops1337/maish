import { useState, useEffect, useCallback } from "react";
import { Trash2, Pencil, Plus, GripVertical, ChevronDown } from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";
import { getLabelsForAccount, type DbLabel } from "@/services/db/labels";
import {
  getQuickStepsForAccount,
  insertQuickStep,
  updateQuickStep,
  deleteQuickStep,
  type DbQuickStep,
} from "@/services/db/quickSteps";
import {
  ACTION_TYPE_METADATA,
  type QuickStepAction,
  type QuickStepActionType,
} from "@/services/quickSteps/types";
import { ALL_CATEGORIES } from "@/services/db/threadCategories";
import { seedDefaultQuickSteps } from "@/services/quickSteps/defaults";

function describeActions(actionsJson: string): string {
  try {
    const actions = JSON.parse(actionsJson) as QuickStepAction[];
    return actions
      .map((a) => {
        const meta = ACTION_TYPE_METADATA.find((m) => m.type === a.type);
        let label = meta?.label ?? a.type;
        if (a.params?.labelId) label += ` (${a.params.labelId})`;
        if (a.params?.category) label += ` (${a.params.category})`;
        return label;
      })
      .join(" -> ");
  } catch {
    return "Invalid actions";
  }
}

export function QuickStepEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [quickSteps, setQuickSteps] = useState<DbQuickStep[]>([]);
  const [labels, setLabels] = useState<DbLabel[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [icon, setIcon] = useState("");
  const [continueOnError, setContinueOnError] = useState(false);
  const [actions, setActions] = useState<QuickStepAction[]>([]);

  const loadQuickSteps = useCallback(async () => {
    if (!activeAccountId) return;
    // Seed defaults if needed
    await seedDefaultQuickSteps(activeAccountId);
    const qs = await getQuickStepsForAccount(activeAccountId);
    setQuickSteps(qs);
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeAccountId) return;
    loadQuickSteps();
    getLabelsForAccount(activeAccountId).then((l) =>
      setLabels(l.filter((lb) => lb.type === "user")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadQuickSteps is stable, only re-run on activeAccountId change
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setShortcut("");
    setIcon("");
    setContinueOnError(false);
    setActions([]);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeAccountId || !name.trim() || actions.length === 0) return;

    if (editingId) {
      await updateQuickStep(editingId, {
        name: name.trim(),
        description: description.trim() || undefined,
        shortcut: shortcut.trim() || null,
        icon: icon.trim() || undefined,
        continueOnError,
        actions,
      });
    } else {
      await insertQuickStep({
        accountId: activeAccountId,
        name: name.trim(),
        description: description.trim() || undefined,
        shortcut: shortcut.trim() || undefined,
        icon: icon.trim() || undefined,
        continueOnError,
        actions,
      });
    }

    resetForm();
    await loadQuickSteps();
  }, [activeAccountId, name, description, shortcut, icon, continueOnError, actions, editingId, resetForm, loadQuickSteps]);

  const handleEdit = useCallback((qs: DbQuickStep) => {
    setEditingId(qs.id);
    setName(qs.name);
    setDescription(qs.description ?? "");
    setShortcut(qs.shortcut ?? "");
    setIcon(qs.icon ?? "");
    setContinueOnError(qs.continue_on_error === 1);

    try {
      setActions(JSON.parse(qs.actions_json) as QuickStepAction[]);
    } catch {
      setActions([]);
    }

    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteQuickStep(id);
    if (editingId === id) resetForm();
    await loadQuickSteps();
  }, [editingId, resetForm, loadQuickSteps]);

  const handleToggleEnabled = useCallback(async (qs: DbQuickStep) => {
    await updateQuickStep(qs.id, { isEnabled: qs.is_enabled !== 1 });
    await loadQuickSteps();
  }, [loadQuickSteps]);

  const addAction = useCallback(() => {
    setActions((prev) => [...prev, { type: "archive" }]);
  }, []);

  const removeAction = useCallback((index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateAction = useCallback((index: number, type: QuickStepActionType) => {
    setActions((prev) => {
      const next = [...prev];
      const meta = ACTION_TYPE_METADATA.find((m) => m.type === type);
      next[index] = { type, ...(meta?.requiresParams ? { params: {} } : {}) };
      return next;
    });
  }, []);

  const updateActionParams = useCallback((index: number, params: QuickStepAction["params"]) => {
    setActions((prev) => {
      const next = [...prev];
      const existing = next[index];
      if (existing) {
        next[index] = { ...existing, params: { ...existing.params, ...params } };
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      {quickSteps.length > 0 && (
        <div className="space-y-0.5">
          {quickSteps.map((qs) => (
            <div
              key={qs.id}
              className="group flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-bg-hover"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <GripVertical size={12} className="text-text-tertiary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                    {qs.name}
                    {qs.shortcut && (
                      <kbd className="font-mono text-[11px] leading-none px-1.5 py-1 rounded border border-border-primary bg-bg-secondary text-text-tertiary">
                        {qs.shortcut}
                      </kbd>
                    )}
                    {qs.is_enabled !== 1 && (
                      <span className="rounded-full border border-border-primary px-1.5 font-mono text-[10px] leading-4 text-text-tertiary">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary truncate">
                    {describeActions(qs.actions_json)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleEnabled(qs)}
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${
                    qs.is_enabled === 1 ? "bg-accent border-accent" : "bg-bg-tertiary border-border-primary"
                  }`}
                  title={qs.is_enabled === 1 ? "Disable" : "Enable"}
                >
                  <span
                    className={`h-3 w-3 rounded-full bg-bg-primary shadow-sm transition-transform ${
                      qs.is_enabled === 1 ? "translate-x-3" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <button
                  onClick={() => handleEdit(qs)}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(qs.id)}
                  className="p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-bg-hover"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="rounded-md border border-border-primary bg-bg-secondary p-3 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Quick step name"
            className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label-mono block mb-1.5">Shortcut (optional)</label>
              <input
                type="text"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="e.g. Ctrl+Shift+1"
                className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10 font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="label-mono block mb-1.5">Icon (optional)</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g. Archive, Star"
                className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
              />
            </div>
          </div>

          <div>
            <div className="label-mono mb-1.5">Action chain</div>
            <div className="space-y-2">
              {actions.map((action, index) => {
                const needsLabelParam = action.type === "applyLabel" || action.type === "removeLabel";
                const needsCategoryParam = action.type === "moveToCategory";
                const needsSnoozeDuration = action.type === "snooze";

                return (
                  <div key={index} className="flex items-start gap-2">
                    <span className="font-mono text-xs tabular-nums text-text-tertiary mt-2 w-5 text-right shrink-0">
                      {index + 1}.
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="relative">
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(index, e.target.value as QuickStepActionType)}
                          className="w-full h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10 appearance-none pr-7"
                        >
                          {ACTION_TYPE_METADATA.map((m) => (
                            <option key={m.type} value={m.type}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
                      </div>
                      {needsLabelParam && labels.length > 0 && (
                        <select
                          value={action.params?.labelId ?? ""}
                          onChange={(e) => updateActionParams(index, { labelId: e.target.value })}
                          className="w-full h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
                        >
                          <option value="">Select label...</option>
                          {labels.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      )}
                      {needsCategoryParam && (
                        <select
                          value={action.params?.category ?? ""}
                          onChange={(e) => updateActionParams(index, { category: e.target.value })}
                          className="w-full h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
                        >
                          <option value="">Select category...</option>
                          {ALL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      )}
                      {needsSnoozeDuration && (
                        <select
                          value={action.params?.snoozeDuration ?? ""}
                          onChange={(e) => updateActionParams(index, { snoozeDuration: Number(e.target.value) })}
                          className="w-full h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
                        >
                          <option value="">Select duration...</option>
                          <option value={3600000}>1 hour</option>
                          <option value={14400000}>4 hours</option>
                          <option value={86400000}>Tomorrow</option>
                          <option value={172800000}>2 days</option>
                          <option value={604800000}>1 week</option>
                        </select>
                      )}
                    </div>
                    <button
                      onClick={() => removeAction(index)}
                      className="p-1 mt-1 rounded-md text-text-tertiary hover:text-danger hover:bg-bg-hover"
                      title="Remove action"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addAction}
              className="inline-flex items-center gap-1 h-7 px-2 -ml-2 mt-2 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Plus size={12} />
              Add action
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={continueOnError}
              onChange={(e) => setContinueOnError(e.target.checked)}
              className="accent-accent"
            />
            Continue on error (run remaining actions even if one fails)
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!name.trim() || actions.length === 0}
              className="h-8 px-3 rounded-md text-sm font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {editingId ? "Update" : "Save"}
            </button>
            <button
              onClick={resetForm}
              className="h-8 px-3 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center h-8 px-3 rounded-md border border-border-primary bg-bg-primary text-sm text-text-primary hover:bg-bg-hover transition-colors"
        >
          + Add quick step
        </button>
      )}
    </div>
  );
}
