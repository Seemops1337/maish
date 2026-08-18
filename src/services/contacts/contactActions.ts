/**
 * The write path for contacts, from the UI to the server and back to the row.
 *
 * Every change goes to the server first and is only stored once it was
 * accepted. The reverse order would show a saved contact that the next sync
 * quietly reverts, which is the failure mode the calendar module ran into
 * before its writes started checking the response status.
 */
import { getAddressBookById } from "@/services/db/addressBooks";
import {
  getContactById,
  updateContact as renameLocalContact,
  updateContactNotes,
  updateDavContactCard,
  upsertDavContact,
  type DbContact,
} from "@/services/db/contacts";
import { getContactsProvider } from "./providerFactory";
import { addressesOf, identityOf, primaryAddressOf } from "./contactSync";
import type { ContactEdits, ContactCardData, CreateContactInput } from "./types";

/** Create a contact in an address book, returning the stored row's id. */
export async function createDavContact(
  addressBookId: string,
  input: CreateContactInput,
): Promise<string> {
  const book = await getAddressBookById(addressBookId);
  if (!book) throw new Error("Address book not found");
  if (book.is_read_only === 1) throw new Error("This address book does not accept changes");

  const provider = await getContactsProvider(book.account_id);
  const card = await provider.createContact(book.remote_id, input);

  return upsertDavContact({
    addressBookId: book.id,
    davUid: identityOf(card),
    davHref: card.remoteContactId,
    davEtag: card.etag,
    vcardData: card.vcardData,
    displayName: card.displayName,
    email: primaryAddressOf(card),
    emails: addressesOf(card),
    phones: card.phones.map((p) => p.number),
    organization: card.organization,
    jobTitle: card.jobTitle,
    note: card.note,
    avatarUrl: card.photoUrl,
  });
}

/** Apply an edit to a synced contact. */
export async function saveDavContact(contactId: string, edits: ContactEdits): Promise<void> {
  const { contact, book } = await resolve(contactId);

  const provider = await getContactsProvider(book.account_id);
  const card = await provider.updateContact(
    book.remote_id,
    contact.dav_href ?? "",
    edits,
    contact.dav_etag ?? undefined,
  );

  await storeCard(contactId, card);
}

export async function removeDavContact(contactId: string): Promise<void> {
  const { contact, book } = await resolve(contactId);

  const provider = await getContactsProvider(book.account_id);
  await provider.deleteContact(contact.dav_href ?? "", contact.dav_etag ?? undefined);

  const { deleteContact } = await import("@/services/db/contacts");
  await deleteContact(contactId);
}

/**
 * Save whatever this contact allows to be changed.
 *
 * A mail-derived row exists only here, so its name and note are stored
 * directly; a synced card belongs to the server and goes through it. Keeping
 * the choice in one place means the UI can offer the same form for both.
 */
export async function saveContact(
  contact: DbContact,
  edits: ContactEdits,
): Promise<void> {
  if (contact.address_book_id) {
    await saveDavContact(contact.id, edits);
    return;
  }

  if (edits.displayName !== undefined) {
    await renameLocalContact(contact.id, edits.displayName || null);
  }
  if (edits.note !== undefined && contact.email) {
    await updateContactNotes(contact.email, edits.note);
  }
}

async function resolve(contactId: string) {
  const contact = await getContactById(contactId);
  if (!contact) throw new Error("Contact not found");
  if (!contact.address_book_id || !contact.dav_href) {
    throw new Error("This contact is not synced to a server");
  }

  const book = await getAddressBookById(contact.address_book_id);
  if (!book) throw new Error("Address book not found");
  if (book.is_read_only === 1) throw new Error("This address book does not accept changes");

  return { contact, book };
}

async function storeCard(contactId: string, card: ContactCardData): Promise<void> {
  await updateDavContactCard(contactId, {
    vcardData: card.vcardData,
    etag: card.etag,
    displayName: card.displayName,
    email: primaryAddressOf(card),
    emails: addressesOf(card),
    phones: card.phones.map((p) => p.number),
    organization: card.organization,
    jobTitle: card.jobTitle,
    note: card.note,
  });
}
