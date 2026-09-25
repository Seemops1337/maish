import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { getEmailProvider } from "@/services/email/providerFactory";
import { Copy, Check } from "lucide-react";

interface RawMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  accountId: string;
}

export function RawMessageModal({
  isOpen,
  onClose,
  messageId,
  accountId,
}: RawMessageModalProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRaw(null);
      setError(null);
      setLoading(false);
      setCopied(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getEmailProvider(accountId)
      .then((provider) => provider.fetchRawMessage(messageId))
      .then((source) => {
        if (!cancelled) {
          setRaw(source);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, messageId, accountId]);

  const handleCopy = useCallback(async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: no-op in non-secure contexts
    }
  }, [raw]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Message Source"
      width="w-[720px] max-w-[90vw]"
      renderHeader={
        <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">
            Message Source
          </h3>
          <div className="flex items-center gap-1">
            {raw && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover text-lg leading-none transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto p-4 bg-bg-secondary rounded-b-md">
        {loading && (
          <div className="flex items-center justify-center py-12 font-mono text-xs text-text-tertiary">
            Loading message source...
          </div>
        )}
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-danger text-sm">
            Failed to load message source: {error}
          </div>
        )}
        {raw && (
          <pre className="text-xs leading-relaxed font-mono text-text-secondary whitespace-pre-wrap break-all select-text">
            {raw}
          </pre>
        )}
      </div>
    </Modal>
  );
}
