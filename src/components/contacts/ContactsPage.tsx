import { useState, useEffect, useCallback, useMemo } from "react";
import { Users, Search, Plus, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAccountStore } from "@/stores/accountStore";
import { getAllContacts, type DbContact } from "@/services/db/contacts";
import {
  getAddressBooksForAccount,
  type DbAddressBook,
} from "@/services/db/addressBooks";
import {
  CONTACTS_SYNC_DONE_EVENT,
  syncContactsForAccount,
} from "@/services/contacts/contactSync";
import { createDavContact } from "@/services/contacts/contactActions";
import { ContactDetail } from "./ContactDetail";

/** Which slice of the list is shown: everything, one book, or the local rows. */
type Filter = { kind: "all" } | { kind: "book"; id: string } | { kind: "local" };

export function ContactsPage() {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.isActive);
  const accountId = activeAccount?.id ?? null;

  const [contacts, setContacts] = useState<DbContact[]>([]);
  const [books, setBooks] = useState<DbAddressBook[]>([]);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [loadedContacts, loadedBooks] = await Promise.all([
      getAllContacts(1000),
      accountId ? getAddressBooksForAccount(accountId) : Promise.resolve([]),
    ]);
    setContacts(loadedContacts);
    setBooks(loadedBooks);
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  // A sync that stored something in the background refreshes the open list.
  useEffect(() => {
    const onSynced = () => { load(); };
    window.addEventListener(CONTACTS_SYNC_DONE_EVENT, onSynced);
    return () => window.removeEventListener(CONTACTS_SYNC_DONE_EVENT, onSynced);
  }, [load]);

  const handleSync = useCallback(async () => {
    if (!accountId) return;
    setSyncing(true);
    try {
      await syncContactsForAccount(accountId);
      await load();
    } finally {
      setSyncing(false);
    }
  }, [accountId, load]);

  const writableBook = books.find((b) => b.is_read_only !== 1 && b.is_visible === 1);

  const handleCreate = useCallback(async () => {
    if (!writableBook) return;
    setCreating(true);
    try {
      const id = await createDavContact(writableBook.id, { displayName: "New contact" });
      await load();
      setSelectedId(id);
    } catch (err) {
      console.error("Could not create the contact:", err);
    } finally {
      setCreating(false);
    }
  }, [writableBook, load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts
      .filter((contact) => {
        if (filter.kind === "book" && contact.address_book_id !== filter.id) return false;
        if (filter.kind === "local" && contact.address_book_id !== null) return false;
        if (!query) return true;
        return (
          (contact.display_name?.toLowerCase().includes(query) ?? false) ||
          (contact.email?.toLowerCase().includes(query) ?? false) ||
          (contact.dav_emails?.toLowerCase().includes(query) ?? false) ||
          (contact.organization?.toLowerCase().includes(query) ?? false)
        );
      })
      .sort((a, b) =>
        (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? ""),
      );
  }, [contacts, filter, search]);

  const selected = visible.find((c) => c.id === selectedId) ?? null;
  const selectedBook = selected?.address_book_id
    ? books.find((b) => b.id === selected.address_book_id)
    : null;

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-80 shrink-0 border-r border-border-primary flex flex-col min-h-0">
        <div className="p-3 space-y-2 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Users size={16} />
              Contacts
            </h1>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Sync contacts"
                icon={syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                onClick={handleSync}
                disabled={syncing || !accountId}
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="New contact"
                icon={creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                onClick={handleCreate}
                disabled={creating || !writableBook}
                title={
                  writableBook
                    ? `Add to ${writableBook.display_name ?? "address book"}`
                    : "Connect a writable address book to add contacts"
                }
              />
            </div>
          </div>

          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts"
              aria-label="Search contacts"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent"
            />
          </div>

          {books.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <FilterChip
                label="All"
                active={filter.kind === "all"}
                onClick={() => setFilter({ kind: "all" })}
              />
              {books.map((book) => (
                <FilterChip
                  key={book.id}
                  label={book.display_name ?? "Address book"}
                  active={filter.kind === "book" && filter.id === book.id}
                  onClick={() => setFilter({ kind: "book", id: book.id })}
                />
              ))}
              <FilterChip
                label="From mail"
                active={filter.kind === "local"}
                onClick={() => setFilter({ kind: "local" })}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-text-tertiary text-center">
                {search ? "No contacts match your search" : "No contacts yet"}
              </p>
            </div>
          ) : (
            visible.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedId(contact.id)}
                className={`w-full text-left px-3 py-2 border-b border-border-secondary transition-colors ${
                  contact.id === selectedId ? "bg-accent/10" : "hover:bg-bg-hover"
                }`}
              >
                <div className="text-sm text-text-primary truncate">
                  {contact.display_name ?? contact.email ?? "Unnamed contact"}
                </div>
                <div className="text-xs text-text-tertiary truncate">
                  {contact.email ?? contact.organization ?? "No address"}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {selected ? (
          <ContactDetail
            contact={selected}
            editable={!selectedBook || selectedBook.is_read_only !== 1}
            onChanged={load}
            onDeleted={() => { setSelectedId(null); load(); }}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No contact selected"
            subtitle="Pick a contact from the list to see their details"
          />
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
        active
          ? "bg-accent/10 border-accent text-accent"
          : "border-border-primary text-text-tertiary hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
