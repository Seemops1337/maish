import { useState, useEffect, useCallback } from "react";
import { Mail, Phone, Building2, Pencil, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { removeDavContact, saveContact } from "@/services/contacts/contactActions";
import type { ContactEmail, ContactPhone } from "@/services/contacts/types";
import type { DbContact } from "@/services/db/contacts";

interface ContactDetailProps {
  contact: DbContact;
  /** False for a read-only book, which the form then only displays. */
  editable: boolean;
  onChanged: () => void;
  onDeleted: () => void;
}

/** A JSON column written by the sync; a malformed one must not blank the page. */
export function readList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function ContactDetail({ contact, editable, onChanged, onDeleted }: ContactDetailProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [note, setNote] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [phones, setPhones] = useState<string[]>([]);

  const isSynced = !!contact.address_book_id;

  const resetForm = useCallback(() => {
    setDisplayName(contact.display_name ?? "");
    setOrganization(contact.organization ?? "");
    setJobTitle(contact.job_title ?? "");
    setNote(contact.notes ?? "");
    setEmails(isSynced ? readList(contact.dav_emails) : contact.email ? [contact.email] : []);
    setPhones(readList(contact.dav_phones));
    setError(null);
  }, [contact, isSynced]);

  // A different contact selected while the form was open would otherwise keep
  // showing the previous one's values.
  useEffect(() => {
    setEditing(false);
    resetForm();
  }, [contact.id, resetForm]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await saveContact(contact, {
        displayName,
        organization: organization || null,
        jobTitle: jobTitle || null,
        note: note || null,
        ...(isSynced
          ? {
              emails: emails
                .map((address, index): ContactEmail => ({
                  address,
                  type: null,
                  isPrimary: index === 0,
                }))
                .filter((e) => e.address.trim()),
              phones: phones
                .map((number): ContactPhone => ({ number, type: null }))
                .filter((p) => p.number.trim()),
            }
          : {}),
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the contact");
    } finally {
      setSaving(false);
    }
  }, [contact, displayName, organization, jobTitle, note, emails, phones, isSynced, onChanged]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await removeDavContact(contact.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the contact");
    } finally {
      setSaving(false);
    }
  }, [contact.id, onDeleted]);

  const initials = (contact.display_name ?? contact.email ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (editing) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <TextField
          label="Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoFocus
        />

        {isSynced && (
          <>
            <ListField
              label="Email"
              values={emails}
              onChange={setEmails}
              placeholder="name@example.org"
              hint="The first address is the one the contact is filed under."
            />
            <ListField
              label="Phone"
              values={phones}
              onChange={setPhones}
              placeholder="+43 1 234567"
            />
            <TextField
              label="Organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
            <TextField
              label="Job title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </>
        )}

        <div>
          <label htmlFor="contact-note" className="text-sm text-text-secondary block mb-1.5">
            Note
          </label>
          <textarea
            id="contact-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full px-3 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent resize-y"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleSave} disabled={saving || !displayName.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setEditing(false); resetForm(); }}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-start gap-4">
        {contact.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt=""
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center text-lg font-medium">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-text-primary truncate">
            {contact.display_name ?? contact.email ?? "Unnamed contact"}
          </h2>
          {(contact.job_title || contact.organization) && (
            <p className="text-sm text-text-secondary truncate">
              {[contact.job_title, contact.organization].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="text-xs text-text-tertiary mt-1">
            {isSynced ? "Synced from an address book" : "Collected from your mail"}
          </p>
        </div>

        {editable && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil size={14} />}
              iconOnly
              aria-label="Edit contact"
              onClick={() => setEditing(true)}
            />
            {isSynced && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={14} />}
                iconOnly
                aria-label="Delete contact"
                onClick={handleDelete}
                disabled={saving}
              />
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger mt-3">{error}</p>}

      <div className="mt-6 space-y-4">
        <Field icon={Mail} label="Email" values={isSynced ? readList(contact.dav_emails) : contact.email ? [contact.email] : []} mailto />
        <Field icon={Phone} label="Phone" values={readList(contact.dav_phones)} />
        <Field
          icon={Building2}
          label="Organization"
          values={contact.organization ? [contact.organization] : []}
        />

        {contact.notes && (
          <div>
            <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">
              Note
            </h3>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  values,
  mailto = false,
}: {
  icon: typeof Mail;
  label: string;
  values: string[];
  mailto?: boolean;
}) {
  if (values.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">
        {label}
      </h3>
      <ul className="space-y-1">
        {values.map((value) => (
          <li key={value} className="flex items-center gap-2 text-sm text-text-primary">
            <Icon size={14} className="text-text-tertiary shrink-0" />
            {mailto ? (
              <a href={`mailto:${value}`} className="hover:text-accent truncate">
                {value}
              </a>
            ) : (
              <span className="truncate">{value}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A repeatable text field, for the properties a card may carry several of. */
function ListField({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div>
      <span className="text-sm text-text-secondary block mb-1.5">{label}</span>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={value}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...values];
                next[index] = e.target.value;
                onChange(next);
              }}
              className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<X size={14} />}
              iconOnly
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => onChange([...values, ""])}
        >
          Add {label.toLowerCase()}
        </Button>
      </div>
      {hint && <p className="text-xs text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}
