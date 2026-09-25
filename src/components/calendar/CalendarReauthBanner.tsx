import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { reauthorizeAccount } from "@/services/gmail/tokenManager";

interface CalendarReauthBannerProps {
  accountId: string;
  email: string;
  onReauthSuccess: () => void;
}

export function CalendarReauthBanner({ accountId, email, onReauthSuccess }: CalendarReauthBannerProps) {
  const [status, setStatus] = useState<"idle" | "authorizing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleReauthorize = async () => {
    setStatus("authorizing");
    setError(null);
    try {
      await reauthorizeAccount(accountId, email);
      onReauthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-authorization failed");
      setStatus("error");
    }
  };

  return (
    <div className="mx-5 my-4 p-4 rounded-md bg-bg-primary border border-border-primary flex items-start gap-3">
      <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">Calendar requires re-authorization</p>
        <p className="text-xs text-text-secondary mt-1">
          Your account was connected before calendar permissions were added.
          Re-authorize to grant calendar access — your emails and data will not be affected.
        </p>
        {error && (
          <p className="text-xs text-danger mt-1.5">{error}</p>
        )}
        <button
          onClick={handleReauthorize}
          disabled={status === "authorizing"}
          className="mt-3 h-8 px-3 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {status === "authorizing" && <Loader2 size={12} className="animate-spin" />}
          {status === "authorizing" ? "Waiting for authorization..." : "Re-authorize"}
        </button>
      </div>
    </div>
  );
}
