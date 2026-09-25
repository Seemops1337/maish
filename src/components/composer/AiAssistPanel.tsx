import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Wand2, Sparkles, ArrowDown, Briefcase } from "lucide-react";
import { isAiAvailable } from "@/services/ai/providerManager";
import {
  composeFromPrompt,
  generateReply,
  transformText,
  type TransformType,
} from "@/services/ai/aiService";
import { useComposerStore } from "@/stores/composerStore";

interface AiAssistPanelProps {
  editor: Editor | null;
  isReplyMode: boolean;
  threadMessages?: string[];
}

export function AiAssistPanel({ editor, isReplyMode, threadMessages }: AiAssistPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const setBodyHtml = useComposerStore((s) => s.setBodyHtml);

  // Check availability on mount
  useEffect(() => {
    isAiAvailable().then(setAvailable);
  }, []);

  if (available === null) return null;
  if (!available) return null;

  const applyToEditor = (html: string) => {
    if (!editor) return;
    editor.chain().focus().setContent(html).run();
    setBodyHtml(editor.getHTML());
  };

  const handleCompose = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await composeFromPrompt(prompt.trim());
      applyToEditor(result);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReply = async () => {
    if (loading || !threadMessages?.length) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateReply(threadMessages, prompt.trim() || undefined);
      applyToEditor(result);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTransform = async (type: TransformType) => {
    if (!editor || loading) return;
    const html = editor.getHTML();
    if (!html || html === "<p></p>") return;
    setLoading(true);
    setError(null);
    try {
      const result = await transformText(html, type);
      applyToEditor(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI transform failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-2.5 border-b border-border-primary bg-bg-secondary">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={12} className="text-text-tertiary" />
        <span className="label-mono">AI Assist</span>
      </div>

      {/* Prompt input */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (isReplyMode) handleGenerateReply();
              else handleCompose();
            }
          }}
          placeholder={isReplyMode ? "Instructions for reply (optional)..." : "Describe what to write..."}
          className="flex-1 h-7 px-2.5 text-xs bg-bg-primary border border-border-primary rounded-md outline-none transition-shadow focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10 text-text-primary placeholder:text-text-tertiary disabled:opacity-50"
          disabled={loading}
        />
        {isReplyMode ? (
          <button
            onClick={handleGenerateReply}
            disabled={loading || !threadMessages?.length}
            className="h-7 px-2.5 text-xs font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {loading ? "..." : "Generate Reply"}
          </button>
        ) : (
          <button
            onClick={handleCompose}
            disabled={loading || !prompt.trim()}
            className="h-7 px-2.5 text-xs font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {loading ? "..." : "Generate"}
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-text-tertiary mr-0.5">Transform:</span>
        <QuickAction
          icon={<Wand2 size={11} />}
          label="Improve"
          onClick={() => handleTransform("improve")}
          disabled={loading}
        />
        <QuickAction
          icon={<ArrowDown size={11} />}
          label="Shorter"
          onClick={() => handleTransform("shorten")}
          disabled={loading}
        />
        <QuickAction
          icon={<Briefcase size={11} />}
          label="Formal"
          onClick={() => handleTransform("formalize")}
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-xs text-danger mt-1.5">{error}</p>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 h-6 px-2 text-xs text-text-secondary hover:text-text-primary bg-bg-primary hover:bg-bg-hover rounded-md border border-border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}
