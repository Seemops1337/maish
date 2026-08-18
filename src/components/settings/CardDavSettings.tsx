import { useState, useCallback, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, BookUser } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import {
  discoverCardDavSettings,
  testCardDavConnection,
} from "@/services/contacts/autoDiscovery";
import { updateAccountCardDav, type DbAccount } from "@/services/db/accounts";
import { removeContactsProvider } from "@/services/contacts/providerFactory";
import {
  getAddressBooksForAccount,
  setAddressBookVisibility,
  type DbAddressBook,
} from "@/services/db/addressBooks";

interface CardDavSettingsProps {
  account: DbAccount;
  onSaved: () => void;
}

export function CardDavSettings({ account, onSaved }: CardDavSettingsProps) {
  const [carddavUrl, setCarddavUrl] = useState(account.carddav_url ?? "");
  const [username, setUsername] = useState(account.carddav_username ?? account.email);
  const [password, setPassword] = useState(account.carddav_password ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [discovered, setDiscovered] = useState(false);
  const [books, setBooks] = useState<DbAddressBook[]>([]);

  // Auto-discover on mount if not already configured
  useEffect(() => {
    if (!account.carddav_url && !discovered) {
      setDiscovered(true);
      discoverCardDavSettings(account.email).then((result) => {
        if (result.carddavUrl) setCarddavUrl(result.carddavUrl);
      });
    }
  }, [account.email, account.carddav_url, discovered]);

  const loadBooks = useCallback(() => {
    if (!account.carddav_url) {
      setBooks([]);
      return;
    }
    getAddressBooksForAccount(account.id).then(setBooks).catch(() => setBooks([]));
  }, [account.id, account.carddav_url]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setTestResult(await testCardDavConnection(carddavUrl, username, password));
    setTesting(false);
  }, [carddavUrl, username, password]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateAccountCardDav(account.id, {
        carddavUrl,
        carddavUsername: username,
        carddavPassword: password,
        contactsProvider: "carddav",
      });
      // The cached provider holds a client logged in with the old credentials.
      removeContactsProvider(account.id);
      onSaved();
    } catch (err) {
      console.error("Failed to save CardDAV settings:", err);
    } finally {
      setSaving(false);
    }
  }, [account.id, carddavUrl, username, password, onSaved]);

  const handleRemove = useCallback(async () => {
    setSaving(true);
    try {
      await updateAccountCardDav(account.id, {
        carddavUrl: "",
        carddavUsername: "",
        carddavPassword: "",
        contactsProvider: "",
      });
      removeContactsProvider(account.id);
      setCarddavUrl("");
      setUsername(account.email);
      setPassword("");
      setTestResult(null);
      setBooks([]);
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [account.id, account.email, onSaved]);

  const handleToggleBook = useCallback(
    async (book: DbAddressBook) => {
      await setAddressBookVisibility(book.id, book.is_visible !== 1);
      loadBooks();
    },
    [loadBooks],
  );

  const isConfigured = !!account.carddav_url;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-primary">Contacts (CardDAV)</h4>
        {isConfigured && <span className="text-xs text-success font-medium">Connected</span>}
      </div>
      <p className="text-xs text-text-tertiary">
        Sync address books from a CardDAV server. Synced contacts appear in the composer's
        autocomplete alongside the ones collected from your mail.
      </p>

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
        label="Password / App Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="App-specific password"
      />

      {testResult && (
        <div
          className={`flex items-center gap-2 text-xs ${testResult.success ? "text-success" : "text-danger"}`}
        >
          {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {testResult.message}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleTest}
          disabled={testing || !carddavUrl || !password}
        >
          {testing && <Loader2 size={14} className="animate-spin" />}
          {testing ? "Testing..." : "Test Connection"}
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving || !carddavUrl || !password}
        >
          {saving ? "Saving..." : "Save"}
        </Button>

        {isConfigured && (
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={saving}>
            Remove
          </Button>
        )}
      </div>

      {isConfigured && books.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border-secondary">
          <h5 className="text-xs font-medium text-text-secondary">Address books</h5>
          {books.map((book) => (
            <label
              key={book.id}
              className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"
            >
              <input
                type="checkbox"
                checked={book.is_visible === 1}
                onChange={() => handleToggleBook(book)}
                className="accent-accent"
              />
              <BookUser size={14} className="text-text-tertiary" />
              <span className="flex-1 truncate">{book.display_name ?? book.remote_id}</span>
              {book.is_read_only === 1 && (
                <span className="text-xs text-text-tertiary">read-only</span>
              )}
            </label>
          ))}
          <p className="text-xs text-text-tertiary">
            A book switched off is left on the server untouched and stops syncing here.
          </p>
        </div>
      )}
    </div>
  );
}
