import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { saveCardDavAccount } from "@/services/db/accounts";
import { useAccountStore } from "@/stores/accountStore";
import {
  discoverCardDavSettings,
  testCardDavConnection,
} from "@/services/contacts/autoDiscovery";

interface AddCardDavAccountProps {
  onClose: () => void;
  onSuccess: () => void;
  onBack: () => void;
}

type Step = "basic" | "server" | "test" | "done";

export function AddCardDavAccount({ onClose, onSuccess, onBack }: AddCardDavAccountProps) {
  const addAccount = useAccountStore((s) => s.addAccount);
  const [step, setStep] = useState<Step>("basic");

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [carddavUrl, setCarddavUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [providerName, setProviderName] = useState<string | null>(null);
  const [needsAppPassword, setNeedsAppPassword] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [addressBookCount, setAddressBookCount] = useState(0);

  const [creating, setCreating] = useState(false);
  const [attachedToExisting, setAttachedToExisting] = useState(false);

  const handleDiscoverAndNext = useCallback(async () => {
    if (!email.trim()) return;
    setUsername(email);

    const result = await discoverCardDavSettings(email);
    if (result.carddavUrl) setCarddavUrl(result.carddavUrl);
    setProviderName(result.providerName);
    setNeedsAppPassword(result.needsAppPassword);
    setStep("server");
  }, [email]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);

    const result = await testCardDavConnection(carddavUrl, username, password);
    setTestResult(result);
    setAddressBookCount(result.addressBookCount ?? 0);
    setTesting(false);
  }, [carddavUrl, username, password]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const { accountId, attachedToExisting } = await saveCardDavAccount({
        id: crypto.randomUUID(),
        email,
        displayName: displayName || null,
        carddavUrl,
        carddavUsername: username,
        carddavPassword: password,
      });

      // An existing account is already in the store — adding it again would
      // duplicate it in the switcher.
      if (!attachedToExisting) {
        addAccount({
          id: accountId,
          email,
          displayName: displayName || null,
          avatarUrl: null,
          isActive: true,
        });
      }

      setAttachedToExisting(attachedToExisting);
      setStep("done");
    } catch (err) {
      console.error("Failed to create CardDAV account:", err);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to save account",
      });
    } finally {
      setCreating(false);
    }
  }, [email, displayName, carddavUrl, username, password, addAccount]);

  return (
    <Modal isOpen={true} onClose={onClose} title="Add CardDAV Contacts" width="w-full max-w-md">
      <div className="p-4">
        {step === "basic" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Users size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-primary">CardDAV Address Book</h3>
                <p className="text-xs text-text-tertiary">
                  Connect to iCloud, Fastmail, Nextcloud, or any CardDAV server
                </p>
              </div>
            </div>

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoFocus
            />

            <TextField
              label="Display Name (optional)"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Contacts"
            />

            <div className="flex justify-between pt-2">
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={handleDiscoverAndNext}
                disabled={!email.trim()}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50"
              >
                Next
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === "server" && (
          <div className="space-y-4">
            {providerName && (
              <div className="text-xs text-accent font-medium">Detected: {providerName}</div>
            )}

            {needsAppPassword && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded text-xs text-text-secondary">
                This provider requires an app-specific password. Generate one in your provider's security settings.
              </div>
            )}

            <TextField
              label="CardDAV Server URL"
              type="url"
              value={carddavUrl}
              onChange={(e) => setCarddavUrl(e.target.value)}
              placeholder="https://carddav.example.com/"
            />

            <TextField
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your@email.com"
            />

            <TextField
              label={needsAppPassword ? "App Password" : "Password"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={needsAppPassword ? "App-specific password" : "Password"}
            />

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep("basic")}
                className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={() => { setStep("test"); handleTest(); }}
                disabled={!carddavUrl || !password}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50"
              >
                Test &amp; Connect
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === "test" && (
          <div className="space-y-4">
            <div className="text-center py-6">
              {testing && (
                <>
                  <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">Testing connection...</p>
                </>
              )}

              {!testing && testResult?.success && (
                <>
                  <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary">{testResult.message}</p>
                  {addressBookCount > 0 && (
                    <p className="text-xs text-text-tertiary mt-1">
                      Found {addressBookCount} address book{addressBookCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </>
              )}

              {!testing && testResult && !testResult.success && (
                <>
                  <XCircle size={32} className="text-danger mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary">Connection failed</p>
                  <p className="text-xs text-text-tertiary mt-1">{testResult.message}</p>
                </>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => { setStep("server"); setTestResult(null); }}
                className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>

              {testResult?.success ? (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Add Account"}
                </button>
              ) : !testing ? (
                <button
                  onClick={handleTest}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
            <p className="text-sm font-medium text-text-primary">
              {attachedToExisting ? "CardDAV contacts connected!" : "CardDAV account added!"}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              {attachedToExisting
                ? `Added to your existing ${email} account. Your contacts will sync automatically.`
                : "Your contacts will sync automatically."}
            </p>
            <button
              onClick={onSuccess}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
