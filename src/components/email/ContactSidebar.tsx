import { useState, useEffect, useRef, useCallback } from "react";
import { FileTypeIcon } from "@/components/ui/FileTypeIcon";
import {
  Mail, Clock, X, Send, Copy, Star, UserPlus, Check, PenLine,
  Paperclip, Building2, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  getContactByEmail, getContactStats, getRecentThreadsWithContact,
  upsertContact, updateContact,
  getAttachmentsFromContact, getContactsFromSameDomain, getLatestAuthResult,
  type ContactStats, type DbContact, type ContactAttachment, type SameDomainContact,
} from "@/services/db/contacts";
import { saveContact } from "@/services/contacts/contactActions";
import { isVipSender, addVipSender, removeVipSender } from "@/services/db/notificationVips";
import { fetchAndCacheGravatarUrl } from "@/services/contacts/gravatar";
import { useThreadStore } from "@/stores/threadStore";
import { useComposerStore } from "@/stores/composerStore";
import { getThreadById, getThreadLabelIds } from "@/services/db/threads";
import { navigateToThread } from "@/router/navigate";
import { formatRelativeDate } from "@/utils/date";
import { formatFileSize } from "@/utils/fileTypeHelpers";
import { AuthBadge } from "./AuthBadge";

interface ContactSidebarProps {
  email: string;
  name: string | null;
  accountId: string;
  onClose: () => void;
}

export function ContactSidebar({ email, name, accountId, onClose }: ContactSidebarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [recentThreads, setRecentThreads] = useState<{ thread_id: string; subject: string | null; last_message_at: number | null }[]>([]);
  const [contact, setContact] = useState<DbContact | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [attachments, setAttachments] = useState<ContactAttachment[]>([]);
  const [sameDomainContacts, setSameDomainContacts] = useState<SameDomainContact[]>([]);
  const [authResults, setAuthResults] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const loadedRef = useRef<string | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleThreadClick = useCallback(async (threadId: string) => {
    const { threads, threadMap, setThreads } = useThreadStore.getState();
    if (threadMap.has(threadId)) {
      navigateToThread(threadId);
      return;
    }
    const dbThread = await getThreadById(accountId, threadId);
    if (!dbThread) return;
    const labelIds = await getThreadLabelIds(accountId, threadId);
    const mapped = {
      id: dbThread.id,
      accountId: dbThread.account_id,
      subject: dbThread.subject,
      snippet: dbThread.snippet,
      lastMessageAt: dbThread.last_message_at ?? 0,
      messageCount: dbThread.message_count,
      isRead: dbThread.is_read === 1,
      isStarred: dbThread.is_starred === 1,
      isPinned: dbThread.is_pinned === 1,
      isMuted: dbThread.is_muted === 1,
      hasAttachments: dbThread.has_attachments === 1,
      labelIds,
      fromName: dbThread.from_name,
      fromAddress: dbThread.from_address,
    };
    setThreads([...threads, mapped]);
    navigateToThread(threadId);
  }, [accountId]);

  useEffect(() => {
    if (!email) return;
    loadedRef.current = email;
    let cancelled = false;

    // Load contact + avatar
    getContactByEmail(email).then((c) => {
      if (cancelled) return;
      setContact(c);
      setNotes(c?.notes ?? "");
      if (c?.avatar_url) {
        setAvatarUrl(c.avatar_url);
      } else {
        fetchAndCacheGravatarUrl(email).then((url) => {
          if (!cancelled) setAvatarUrl(url);
        });
      }
    });

    // Load stats
    getContactStats(email).then((s) => { if (!cancelled) setStats(s); });

    // Load recent threads
    getRecentThreadsWithContact(email).then((t) => { if (!cancelled) setRecentThreads(t); });

    // Load VIP status
    isVipSender(accountId, email).then((v) => { if (!cancelled) setIsVip(v); });

    // Load attachments from contact
    getAttachmentsFromContact(email).then((a) => { if (!cancelled) setAttachments(a); });

    // Load same-domain contacts
    getContactsFromSameDomain(email).then((c) => { if (!cancelled) setSameDomainContacts(c); });

    // Load auth results
    getLatestAuthResult(email).then((r) => { if (!cancelled) setAuthResults(r); });

    return () => { cancelled = true; };
  }, [email, accountId]);

  // -- Event handlers --

  const handleCompose = useCallback(() => {
    useComposerStore.getState().openComposer({ mode: "new", to: [email] });
  }, [email]);

  const handleCopyEmail = useCallback(() => {
    navigator.clipboard.writeText(email);
    setCopyFeedback(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyFeedback(false), 1500);
  }, [email]);

  const handleToggleVip = useCallback(async () => {
    if (isVip) {
      await removeVipSender(accountId, email);
      setIsVip(false);
    } else {
      await addVipSender(accountId, email, name ?? undefined);
      setIsVip(true);
    }
  }, [accountId, email, name, isVip]);

  /**
   * Save a note the way this contact can be saved.
   *
   * A contact synced from an address book belongs to the server: its note
   * lives in the vCard, and the next contactSync writes what the server holds
   * over the local row. Storing the note locally, as this used to, therefore
   * kept it only until the next sync. saveContact knows which of the two a
   * contact is and puts the note where it survives.
   */
  const persistNotes = useCallback(async (value: string) => {
    if (!contact) return;
    try {
      await saveContact(contact, { note: value });
    } catch (err) {
      console.error("Failed to save contact note:", err);
    }
  }, [contact]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);

    // A synced card is saved on blur only. Each save is a PUT carrying the
    // card's etag, and a debounced write racing the one on blur would send
    // the second with an etag the first had already superseded — which the
    // server refuses with 412.
    if (contact?.address_book_id) return;

    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      void persistNotes(value);
    }, 1000);
  }, [contact, persistNotes]);

  const handleNotesBlur = useCallback(() => {
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
      notesTimerRef.current = null;
    }
    void persistNotes(notes);
  }, [notes, persistNotes]);

  const handleAddContact = useCallback(async () => {
    await upsertContact(email, name);
    const c = await getContactByEmail(email);
    setContact(c);
    setAddedFeedback(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setAddedFeedback(false), 1500);
  }, [email, name]);

  const handleStartEditName = useCallback(() => {
    setEditNameValue(contact?.display_name ?? name ?? "");
    setEditingName(true);
  }, [contact, name]);

  const handleSaveEditName = useCallback(async () => {
    if (!contact) return;
    const trimmed = editNameValue.trim();
    await updateContact(contact.id, trimmed || null);
    setContact({ ...contact, display_name: trimmed || null });
    setEditingName(false);
  }, [contact, editNameValue]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    };
  }, []);

  const displayName = contact?.display_name ?? name ?? email.split("@")[0];
  const initial = (displayName?.[0] ?? "?").toUpperCase();
  const domain = email.includes("@") ? email.split("@")[1] : null;

  return (
    <div className="w-72 h-full border-l border-border-primary bg-bg-secondary overflow-y-auto shrink-0">
      <div className="px-4 pt-3 pb-4">
        {/* Close button */}
        <div className="flex justify-end -mr-1.5 mb-1">
          <button
            onClick={onClose}
            title="Close contact sidebar"
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center text-center mb-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-14 h-14 rounded-full mb-3 border border-border-primary"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-bg-tertiary text-text-secondary border border-border-primary flex items-center justify-center text-lg font-medium mb-3">
              {initial}
            </div>
          )}

          {/* Name + Auth Badge */}
          {editingName ? (
            <div className="flex items-center gap-1 mb-0.5">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEditName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
                className="w-40 h-7 text-sm text-center bg-bg-primary border border-border-primary rounded-md px-2 text-text-primary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10"
              />
              <button
                onClick={handleSaveEditName}
                title="Save name"
                className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <span>{displayName}</span>
              <AuthBadge authResults={authResults} />
            </div>
          )}

          <div className="font-mono text-xs text-text-tertiary mt-1 break-all">
            {email}
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="flex items-center justify-center gap-1 mb-3">
          <button
            onClick={handleCompose}
            title="Send email"
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Send size={16} />
          </button>
          <button
            onClick={handleCopyEmail}
            title={copyFeedback ? "Copied!" : "Copy email"}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            {copyFeedback ? <Check size={16} className="text-success" /> : <Copy size={16} />}
          </button>
          <button
            onClick={handleToggleVip}
            title={isVip ? "Remove VIP" : "Mark as VIP"}
            className={`p-1.5 rounded-md transition-colors hover:bg-bg-hover ${
              isVip
                ? "text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Star size={16} fill={isVip ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Add / Edit Contact */}
        {!contact ? (
          <button
            onClick={handleAddContact}
            className="w-full h-8 flex items-center justify-center gap-1.5 px-3 text-sm font-medium text-text-primary bg-bg-primary border border-border-primary rounded-md hover:bg-bg-hover transition-colors mb-4"
          >
            {addedFeedback ? (
              <>
                <Check size={14} className="text-success" />
                <span className="text-success">Added!</span>
              </>
            ) : (
              <>
                <UserPlus size={14} />
                <span>Add to Contacts</span>
              </>
            )}
          </button>
        ) : !editingName ? (
          <button
            onClick={handleStartEditName}
            className="w-full h-7 flex items-center justify-center gap-1.5 px-3 text-xs rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors mb-4"
          >
            <PenLine size={12} />
            <span>Edit name</span>
          </button>
        ) : null}

        {/* Stats */}
        {stats && (
          <div className="border-t border-border-primary pt-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Mail size={12} className="text-text-tertiary shrink-0" />
              <span className="font-mono tabular-nums">{stats.emailCount} emails</span>
            </div>
            {stats.firstEmail && (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Clock size={12} className="text-text-tertiary shrink-0" />
                <span>First email: <span className="font-mono tabular-nums text-text-tertiary">{formatRelativeDate(stats.firstEmail)}</span></span>
              </div>
            )}
            {stats.lastEmail && (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Clock size={12} className="text-text-tertiary shrink-0" />
                <span>Last email: <span className="font-mono tabular-nums text-text-tertiary">{formatRelativeDate(stats.lastEmail)}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Contact Notes */}
        {contact && (
          <div className="border-t border-border-primary py-3">
            <button
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="label-mono flex items-center gap-1 hover:text-text-primary transition-colors"
            >
              {notesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Notes
            </button>
            {notesExpanded && (
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add a note..."
                rows={3}
                className="mt-2 w-full text-[13px] bg-bg-primary border border-border-primary rounded-md px-3 py-2 text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10 resize-y"
              />
            )}
          </div>
        )}

        {/* Shared Files */}
        {attachments.length > 0 && (
          <div className="border-t border-border-primary py-3">
            <h4 className="label-mono flex items-center gap-1 mb-2">
              <Paperclip size={11} />
              Shared Files
            </h4>
            <div className="space-y-px -mx-2">
              {attachments.map((att, i) => (
                <div
                  key={`${att.filename}-${att.date}-${i}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors"
                >
                  <FileTypeIcon mimeType={att.mime_type} size={14} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-text-secondary truncate">{att.filename}</div>
                    <div className="font-mono text-[11px] tabular-nums text-text-tertiary">
                      {att.size != null && formatFileSize(att.size)}
                      {att.size != null && " · "}
                      {formatRelativeDate(att.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Same-Domain Contacts */}
        {sameDomainContacts.length > 0 && domain && (
          <div className="border-t border-border-primary py-3">
            <h4 className="label-mono flex items-center gap-1 mb-2">
              <Building2 size={11} />
              Others at @{domain}
            </h4>
            <div className="space-y-px -mx-2">
              {sameDomainContacts.map((c) => (
                <div
                  key={c.email}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors"
                >
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0 border border-border-primary" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-bg-tertiary text-text-secondary border border-border-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                      {(c.display_name?.[0] ?? c.email[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[13px] text-text-secondary truncate">
                      {c.display_name ?? c.email.split("@")[0]}
                    </div>
                    <div className="font-mono text-[11px] text-text-tertiary truncate">{c.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent threads */}
        {recentThreads.length > 0 && (
          <div className="border-t border-border-primary pt-3">
            <h4 className="label-mono mb-2">
              Recent Conversations
            </h4>
            <div className="space-y-px -mx-2">
              {recentThreads.map((thread) => (
                <button
                  key={thread.thread_id}
                  onClick={() => handleThreadClick(thread.thread_id)}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors group"
                >
                  <div className="text-[13px] text-text-secondary group-hover:text-text-primary truncate">
                    {thread.subject ?? "(No subject)"}
                  </div>
                  {thread.last_message_at && (
                    <div className="font-mono text-[11px] tabular-nums text-text-tertiary mt-0.5">
                      {formatRelativeDate(thread.last_message_at)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
