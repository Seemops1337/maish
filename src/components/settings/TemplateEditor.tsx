import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Trash2, Pencil, ChevronDown } from "lucide-react";
import { EditorToolbar } from "@/components/composer/EditorToolbar";
import { useAccountStore } from "@/stores/accountStore";
import {
  getTemplatesForAccount,
  insertTemplate,
  updateTemplate,
  deleteTemplate,
  type DbTemplate,
} from "@/services/db/templates";
import { TEMPLATE_VARIABLES } from "@/utils/templateVariables";

export function TemplateEditor() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [showForm, setShowForm] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Image.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder: "Write your template..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2 min-h-[80px] focus:outline-none text-text-primary text-xs",
      },
    },
  });

  const loadTemplates = useCallback(async () => {
    if (!activeAccountId) return;
    const tmpls = await getTemplatesForAccount(activeAccountId);
    setTemplates(tmpls);
  }, [activeAccountId]);

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadTemplates is stable, only re-run on activeAccountId change
  }, [activeAccountId]);

  const resetForm = useCallback(() => {
    setName("");
    setSubject("");
    setShortcut("");
    setEditingId(null);
    setShowForm(false);
    editor?.commands.setContent("");
  }, [editor]);

  const handleSave = useCallback(async () => {
    if (!activeAccountId || !editor || !name.trim()) return;

    const bodyHtml = editor.getHTML();

    if (editingId) {
      await updateTemplate(editingId, {
        name: name.trim(),
        subject: subject.trim() || null,
        bodyHtml,
        shortcut: shortcut.trim() || null,
      });
    } else {
      await insertTemplate({
        accountId: activeAccountId,
        name: name.trim(),
        subject: subject.trim() || null,
        bodyHtml,
        shortcut: shortcut.trim() || null,
      });
    }

    resetForm();
    await loadTemplates();
  }, [activeAccountId, editor, name, subject, shortcut, editingId, resetForm, loadTemplates]);

  const handleEdit = useCallback((tmpl: DbTemplate) => {
    setEditingId(tmpl.id);
    setName(tmpl.name);
    setSubject(tmpl.subject ?? "");
    setShortcut(tmpl.shortcut ?? "");
    setShowForm(true);
    editor?.commands.setContent(tmpl.body_html);
  }, [editor]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteTemplate(id);
    if (editingId === id) resetForm();
    await loadTemplates();
  }, [editingId, resetForm, loadTemplates]);

  return (
    <div className="space-y-3">
      {templates.length > 0 && (
        <div className="space-y-0.5">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="group flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-bg-hover"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                  {tmpl.name}
                  {tmpl.shortcut && (
                    <kbd className="font-mono text-[11px] leading-none px-1.5 py-1 rounded border border-border-primary bg-bg-secondary text-text-tertiary">
                      {tmpl.shortcut}
                    </kbd>
                  )}
                </div>
                {tmpl.subject && (
                  <div className="text-xs text-text-tertiary truncate">{tmpl.subject}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(tmpl)}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(tmpl.id)}
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
            placeholder="Template name"
            className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
          <div className="border border-border-primary rounded-md overflow-hidden bg-bg-primary">
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
          <InsertVariableDropdown
            onInsert={(variable) => {
              editor?.chain().focus().insertContent(variable).run();
            }}
          />
          <input
            type="text"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="Shortcut (optional, e.g. /thanks)"
            className="w-full h-8 px-3 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
          />
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
          + Add template
        </button>
      )}
    </div>
  );
}

function InsertVariableDropdown({ onInsert }: { onInsert: (variable: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
      >
        Insert variable
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 bg-bg-primary border border-border-primary rounded-md shadow-lg py-1 min-w-[220px]">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                onInsert(v.key);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-bg-hover text-xs flex items-center justify-between gap-3"
            >
              <code className="font-mono text-text-primary">{v.key}</code>
              <span className="text-text-tertiary">{v.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
