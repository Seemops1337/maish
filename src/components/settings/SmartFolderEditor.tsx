import { useState, useEffect, useCallback } from "react";
import { Trash2, Pencil } from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";
import {
  getSmartFolders,
  insertSmartFolder,
  updateSmartFolder,
  deleteSmartFolder,
  type DbSmartFolder,
} from "@/services/db/smartFolders";
import { useSmartFolderStore } from "@/stores/smartFolderStore";

export function SmartFolderEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const reloadStore = useSmartFolderStore((s) => s.loadFolders);
  const [folders, setFolders] = useState<DbSmartFolder[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [icon, setIcon] = useState("Search");
  const [color, setColor] = useState("");

  const loadFolders = useCallback(async () => {
    const f = await getSmartFolders(activeAccountId ?? undefined);
    setFolders(f);
  }, [activeAccountId]);

  useEffect(() => {
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFolders is stable, only re-run on activeAccountId change
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setName("");
    setQuery("");
    setIcon("Search");
    setColor("");
    setEditingId(null);
    setShowForm(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !query.trim()) return;

    if (editingId) {
      await updateSmartFolder(editingId, {
        name: name.trim(),
        query: query.trim(),
        icon: icon.trim() || "Search",
        color: color.trim() || undefined,
      });
    } else {
      await insertSmartFolder({
        name: name.trim(),
        query: query.trim(),
        accountId: activeAccountId ?? undefined,
        icon: icon.trim() || "Search",
        color: color.trim() || undefined,
      });
    }

    resetForm();
    await loadFolders();
    await reloadStore(activeAccountId ?? undefined);
  }, [activeAccountId, name, query, icon, color, editingId, resetForm, loadFolders, reloadStore]);

  const handleEdit = useCallback((folder: DbSmartFolder) => {
    setEditingId(folder.id);
    setName(folder.name);
    setQuery(folder.query);
    setIcon(folder.icon);
    setColor(folder.color ?? "");
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSmartFolder(id);
    if (editingId === id) resetForm();
    await loadFolders();
    await reloadStore(activeAccountId ?? undefined);
  }, [editingId, resetForm, loadFolders, reloadStore, activeAccountId]);

  return (
    <div className="space-y-3">
      {folders.length > 0 && (
        <div className="space-y-0.5">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="group flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-bg-hover"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                  {folder.name}
                  {folder.is_default === 1 && (
                    <span className="rounded-full border border-border-primary px-1.5 font-mono text-[10px] leading-4 text-text-secondary">
                      Default
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-text-tertiary truncate">
                  {folder.query}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(folder)}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                {folder.is_default !== 1 && (
                  <button
                    onClick={() => handleDelete(folder.id)}
                    className="p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-bg-hover"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
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
            placeholder="Folder name"
            className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query (e.g. is:unread from:boss)"
            className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label-mono block mb-1.5">
                Icon name
              </label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Search"
                className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
              />
              <p className="font-mono text-[11px] text-text-tertiary mt-1">
                Search, MailOpen, Paperclip, Star, FolderSearch, Inbox, Clock, Tag
              </p>
            </div>
            <div className="flex-1">
              <label className="label-mono block mb-1.5">
                Color (optional)
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#6366f1"
                className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!name.trim() || !query.trim()}
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
          + Add smart folder
        </button>
      )}
    </div>
  );
}
