import { useState, useEffect, useCallback } from "react";
import { Trash2, Pencil, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { TextField } from "@/components/ui/TextField";
import { useAccountStore } from "@/stores/accountStore";
import { getLabelsForAccount, type DbLabel } from "@/services/db/labels";
import {
  getSmartLabelRulesForAccount,
  insertSmartLabelRule,
  updateSmartLabelRule,
  deleteSmartLabelRule,
  type DbSmartLabelRule,
} from "@/services/db/smartLabelRules";
import type { FilterCriteria } from "@/services/db/filters";
import { backfillSmartLabels } from "@/services/smartLabels/backfillService";

export function SmartLabelEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [rules, setRules] = useState<DbSmartLabelRule[]>([]);
  const [labels, setLabels] = useState<DbLabel[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  // Form state
  const [labelId, setLabelId] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [criteriaFrom, setCriteriaFrom] = useState("");
  const [criteriaTo, setCriteriaTo] = useState("");
  const [criteriaSubject, setCriteriaSubject] = useState("");
  const [criteriaBody, setCriteriaBody] = useState("");
  const [criteriaHasAttachment, setCriteriaHasAttachment] = useState(false);

  const loadRules = useCallback(async () => {
    if (!activeAccountId) return;
    const r = await getSmartLabelRulesForAccount(activeAccountId);
    setRules(r);
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeAccountId) return;
    loadRules();
    getLabelsForAccount(activeAccountId).then((l) =>
      setLabels(l.filter((lb) => lb.type === "user")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadRules is stable
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setLabelId("");
    setAiDescription("");
    setCriteriaFrom("");
    setCriteriaTo("");
    setCriteriaSubject("");
    setCriteriaBody("");
    setCriteriaHasAttachment(false);
    setShowCriteria(false);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const buildCriteria = (): FilterCriteria | undefined => {
    const c: FilterCriteria = {};
    if (criteriaFrom.trim()) c.from = criteriaFrom.trim();
    if (criteriaTo.trim()) c.to = criteriaTo.trim();
    if (criteriaSubject.trim()) c.subject = criteriaSubject.trim();
    if (criteriaBody.trim()) c.body = criteriaBody.trim();
    if (criteriaHasAttachment) c.hasAttachment = true;
    return Object.keys(c).length > 0 ? c : undefined;
  };

  const handleSave = useCallback(async () => {
    if (!activeAccountId || !labelId || !aiDescription.trim()) return;
    const criteria = buildCriteria();

    if (editingId) {
      await updateSmartLabelRule(editingId, {
        labelId,
        aiDescription: aiDescription.trim(),
        criteria: criteria ?? null,
      });
    } else {
      await insertSmartLabelRule({
        accountId: activeAccountId,
        labelId,
        aiDescription: aiDescription.trim(),
        criteria,
      });
    }

    resetForm();
    await loadRules();
  }, [activeAccountId, labelId, aiDescription, editingId, resetForm, loadRules, criteriaFrom, criteriaTo, criteriaSubject, criteriaBody, criteriaHasAttachment]);

  const handleEdit = useCallback((rule: DbSmartLabelRule) => {
    setEditingId(rule.id);
    setLabelId(rule.label_id);
    setAiDescription(rule.ai_description);

    let criteria: FilterCriteria = {};
    if (rule.criteria_json) {
      try { criteria = JSON.parse(rule.criteria_json); } catch { /* empty */ }
    }

    setCriteriaFrom(criteria.from ?? "");
    setCriteriaTo(criteria.to ?? "");
    setCriteriaSubject(criteria.subject ?? "");
    setCriteriaBody(criteria.body ?? "");
    setCriteriaHasAttachment(criteria.hasAttachment ?? false);
    setShowCriteria(Object.keys(criteria).length > 0);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSmartLabelRule(id);
    if (editingId === id) resetForm();
    await loadRules();
  }, [editingId, resetForm, loadRules]);

  const handleToggleEnabled = useCallback(async (rule: DbSmartLabelRule) => {
    await updateSmartLabelRule(rule.id, { isEnabled: rule.is_enabled !== 1 });
    await loadRules();
  }, [loadRules]);

  const handleBackfill = useCallback(async () => {
    if (!activeAccountId || backfilling) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const count = await backfillSmartLabels(activeAccountId);
      setBackfillResult(`Applied ${count} label${count !== 1 ? "s" : ""} to existing emails.`);
    } catch (err) {
      setBackfillResult("Backfill failed. Check your AI provider settings.");
      console.error("Smart label backfill failed:", err);
    } finally {
      setBackfilling(false);
    }
  }, [activeAccountId, backfilling]);

  const getLabelName = useCallback(
    (id: string) => labels.find((l) => l.id === id)?.name ?? id,
    [labels],
  );

  return (
    <div className="space-y-3">
      {rules.length > 0 && (
        <button
          onClick={handleBackfill}
          disabled={backfilling}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border-primary bg-bg-primary text-xs text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
        >
          {backfilling && <Loader2 size={12} className="animate-spin" />}
          {backfilling ? "Applying to existing emails..." : "Apply to existing emails"}
        </button>
      )}

      {backfillResult && (
        <div className="text-xs text-text-tertiary">{backfillResult}</div>
      )}

      {rules.length > 0 && (
        <div className="space-y-0.5">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="group flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-bg-hover"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                  {getLabelName(rule.label_id)}
                  {rule.is_enabled !== 1 && (
                    <span className="rounded-full border border-border-primary px-1.5 font-mono text-[10px] leading-4 text-text-tertiary">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-tertiary truncate">
                  {rule.ai_description}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleEnabled(rule)}
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${
                    rule.is_enabled === 1 ? "bg-accent border-accent" : "bg-bg-tertiary border-border-primary"
                  }`}
                  title={rule.is_enabled === 1 ? "Disable" : "Enable"}
                >
                  <span
                    className={`h-3 w-3 rounded-full bg-bg-primary shadow-sm transition-transform ${
                      rule.is_enabled === 1 ? "translate-x-3" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <button
                  onClick={() => handleEdit(rule)}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
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
          {labels.length > 0 ? (
            <div>
              <div className="label-mono mb-1.5">Label</div>
              <select
                value={labelId}
                onChange={(e) => setLabelId(e.target.value)}
                className="w-full h-8 bg-bg-primary text-text-primary text-sm px-2.5 rounded-md border border-border-primary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
              >
                <option value="">Select a label...</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-text-tertiary">
              No user labels found. Create a label first.
            </div>
          )}

          <div>
            <div className="label-mono mb-1.5">AI Description</div>
            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="e.g., Job applications and career opportunities"
              rows={2}
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10 resize-none"
            />
          </div>

          <div>
            <button
              onClick={() => setShowCriteria(!showCriteria)}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {showCriteria ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Optional filter criteria
            </button>

            {showCriteria && (
              <div className="mt-2 space-y-1.5">
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
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!labelId || !aiDescription.trim()}
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
          + Add smart label
        </button>
      )}
    </div>
  );
}
