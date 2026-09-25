import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2, Pencil } from "lucide-react";
import { TextField } from "@/components/ui/TextField";
import { useAccountStore } from "@/stores/accountStore";
import { getLabelsForAccount, type DbLabel } from "@/services/db/labels";
import {
  getFiltersForAccount,
  insertFilter,
  updateFilter,
  deleteFilter,
  type DbFilterRule,
  type FilterCriteria,
  type FilterActions,
} from "@/services/db/filters";

export function FilterEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [filters, setFilters] = useState<DbFilterRule[]>([]);
  const [labels, setLabels] = useState<DbLabel[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [criteriaFrom, setCriteriaFrom] = useState("");
  const [criteriaTo, setCriteriaTo] = useState("");
  const [criteriaSubject, setCriteriaSubject] = useState("");
  const [criteriaBody, setCriteriaBody] = useState("");
  const [criteriaHasAttachment, setCriteriaHasAttachment] = useState(false);
  const [actionLabel, setActionLabel] = useState("");
  const [actionArchive, setActionArchive] = useState(false);
  const [actionStar, setActionStar] = useState(false);
  const [actionMarkRead, setActionMarkRead] = useState(false);
  const [actionTrash, setActionTrash] = useState(false);

  const loadFilters = useCallback(async () => {
    if (!activeAccountId) return;
    const f = await getFiltersForAccount(activeAccountId);
    setFilters(f);
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeAccountId) return;
    loadFilters();
    getLabelsForAccount(activeAccountId).then((l) =>
      setLabels(l.filter((lb) => lb.type === "user")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFilters is stable, only re-run on activeAccountId change
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setName("");
    setCriteriaFrom("");
    setCriteriaTo("");
    setCriteriaSubject("");
    setCriteriaBody("");
    setCriteriaHasAttachment(false);
    setActionLabel("");
    setActionArchive(false);
    setActionStar(false);
    setActionMarkRead(false);
    setActionTrash(false);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const buildCriteria = (): FilterCriteria => {
    const c: FilterCriteria = {};
    if (criteriaFrom.trim()) c.from = criteriaFrom.trim();
    if (criteriaTo.trim()) c.to = criteriaTo.trim();
    if (criteriaSubject.trim()) c.subject = criteriaSubject.trim();
    if (criteriaBody.trim()) c.body = criteriaBody.trim();
    if (criteriaHasAttachment) c.hasAttachment = true;
    return c;
  };

  const buildActions = (): FilterActions => {
    const a: FilterActions = {};
    if (actionLabel) a.applyLabel = actionLabel;
    if (actionArchive) a.archive = true;
    if (actionStar) a.star = true;
    if (actionMarkRead) a.markRead = true;
    if (actionTrash) a.trash = true;
    return a;
  };

  const handleSave = useCallback(async () => {
    if (!activeAccountId || !name.trim()) return;
    const criteria = buildCriteria();
    const actions = buildActions();

    if (editingId) {
      await updateFilter(editingId, { name: name.trim(), criteria, actions });
    } else {
      await insertFilter({
        accountId: activeAccountId,
        name: name.trim(),
        criteria,
        actions,
      });
    }

    resetForm();
    await loadFilters();
  }, [activeAccountId, name, editingId, resetForm, loadFilters, criteriaFrom, criteriaTo, criteriaSubject, criteriaBody, criteriaHasAttachment, actionLabel, actionArchive, actionStar, actionMarkRead, actionTrash]);

  const handleEdit = useCallback((filter: DbFilterRule) => {
    setEditingId(filter.id);
    setName(filter.name);

    let criteria: FilterCriteria = {};
    let actions: FilterActions = {};
    try { criteria = JSON.parse(filter.criteria_json); } catch { /* empty */ }
    try { actions = JSON.parse(filter.actions_json); } catch { /* empty */ }

    setCriteriaFrom(criteria.from ?? "");
    setCriteriaTo(criteria.to ?? "");
    setCriteriaSubject(criteria.subject ?? "");
    setCriteriaBody(criteria.body ?? "");
    setCriteriaHasAttachment(criteria.hasAttachment ?? false);
    setActionLabel(actions.applyLabel ?? "");
    setActionArchive(actions.archive ?? false);
    setActionStar(actions.star ?? false);
    setActionMarkRead(actions.markRead ?? false);
    setActionTrash(actions.trash ?? false);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteFilter(id);
    if (editingId === id) resetForm();
    await loadFilters();
  }, [editingId, resetForm, loadFilters]);

  const handleToggleEnabled = useCallback(async (filter: DbFilterRule) => {
    await updateFilter(filter.id, { isEnabled: filter.is_enabled !== 1 });
    await loadFilters();
  }, [loadFilters]);

  const filterDescriptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const filter of filters) {
      try {
        const c = JSON.parse(filter.criteria_json) as FilterCriteria;
        const parts: string[] = [];
        if (c.from) parts.push(`from: ${c.from}`);
        if (c.to) parts.push(`to: ${c.to}`);
        if (c.subject) parts.push(`subject: ${c.subject}`);
        if (c.body) parts.push(`body: ${c.body}`);
        if (c.hasAttachment) parts.push("has attachment");
        map.set(filter.id, parts.join(", ") || "No criteria");
      } catch {
        map.set(filter.id, "Invalid criteria");
      }
    }
    return map;
  }, [filters]);

  return (
    <div className="space-y-3">
      {filters.length > 0 && (
        <div className="space-y-0.5">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="group flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-bg-hover"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                  {filter.name}
                  {filter.is_enabled !== 1 && (
                    <span className="rounded-full border border-border-primary px-1.5 font-mono text-[10px] leading-4 text-text-tertiary">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-tertiary truncate">
                  {filterDescriptions.get(filter.id) ?? "No criteria"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleEnabled(filter)}
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${
                    filter.is_enabled === 1 ? "bg-accent border-accent" : "bg-bg-tertiary border-border-primary"
                  }`}
                  title={filter.is_enabled === 1 ? "Disable" : "Enable"}
                >
                  <span
                    className={`h-3 w-3 rounded-full bg-bg-primary shadow-sm transition-transform ${
                      filter.is_enabled === 1 ? "translate-x-3" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <button
                  onClick={() => handleEdit(filter)}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(filter.id)}
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
          <TextField
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Filter name"
          />

          <div>
            <div className="label-mono mb-1.5">Match criteria</div>
            <div className="space-y-1.5">
              <TextField
                type="text"
                value={criteriaFrom}
                onChange={(e) => setCriteriaFrom(e.target.value)}
                placeholder="From contains..."
              />
              <TextField
                type="text"
                value={criteriaTo}
                onChange={(e) => setCriteriaTo(e.target.value)}
                placeholder="To contains..."
              />
              <TextField
                type="text"
                value={criteriaSubject}
                onChange={(e) => setCriteriaSubject(e.target.value)}
                placeholder="Subject contains..."
              />
              <TextField
                type="text"
                value={criteriaBody}
                onChange={(e) => setCriteriaBody(e.target.value)}
                placeholder="Body contains..."
              />
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={criteriaHasAttachment}
                  onChange={(e) => setCriteriaHasAttachment(e.target.checked)}
                  className="accent-accent"
                />
                Has attachment
              </label>
            </div>
          </div>

          <div>
            <div className="label-mono mb-1.5">Actions</div>
            <div className="space-y-1.5">
              {labels.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary w-20">Apply label</span>
                  <select
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    className="flex-1 h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
                  >
                    <option value="">None</option>
                    {labels.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={actionArchive} onChange={(e) => setActionArchive(e.target.checked)} className="accent-accent" />
                  Archive
                </label>
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={actionStar} onChange={(e) => setActionStar(e.target.checked)} className="accent-accent" />
                  Star
                </label>
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={actionMarkRead} onChange={(e) => setActionMarkRead(e.target.checked)} className="accent-accent" />
                  Mark as read
                </label>
                <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={actionTrash} onChange={(e) => setActionTrash(e.target.checked)} className="accent-accent" />
                  Trash
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
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
          + Add filter
        </button>
      )}
    </div>
  );
}
