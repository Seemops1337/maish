/**
 * Bringing a server's address books into the local contacts table.
 *
 * The shape mirrors `syncCalendarForAccount`: discover the collections, then
 * walk the visible ones and store what they hold. Two things are specific to
 * contacts. A card is stored under the UID it carries rather than its URL, so
 * a rename on the server does not read as a delete followed by an insert. And
 * the local table already holds contacts of its own, harvested from mail
 * headers, so a synced card that claims an address one of those rows was filed
 * under has to absorb it — see `absorbLocalContact`.
 */
import {
  getVisibleAddressBooks,
  updateAddressBookSyncState,
  upsertAddressBook,
  type DbAddressBook,
} from "@/services/db/addressBooks";
import {
  absorbLocalContact,
  deleteDavContactsMissingFrom,
  findLocalContactByEmail,
  updateDavContactCard,
  upsertDavContact,
} from "@/services/db/contacts";
import { normalizeEmail } from "@/utils/emailUtils";
import { getContactsProvider, hasContactsSupport } from "./providerFactory";
import type { AddressBookInfo, ContactCardData, ContactsProvider } from "./types";

/** Fired once a run has stored what it fetched, so open views can reload. */
export const CONTACTS_SYNC_DONE_EVENT = "maish-contacts-sync-done";

export async function syncContactsForAccount(accountId: string): Promise<void> {
  try {
    if (!(await hasContactsSupport(accountId))) return;

    const provider = await getContactsProvider(accountId);
    const remoteBooks = await provider.listAddressBooks();

    for (const book of remoteBooks) {
      await upsertAddressBook({
        accountId,
        provider: provider.type,
        remoteId: book.remoteId,
        displayName: book.displayName,
        description: book.description,
        isReadOnly: book.isReadOnly,
      });
    }

    let stored = 0;
    for (const book of await getVisibleAddressBooks(accountId)) {
      const remote = remoteBooks.find((b) => b.remoteId === book.remote_id);
      try {
        stored += await syncAddressBook(provider, book, remote);
      } catch (err) {
        console.warn(
          `[contactSync] Sync failed for ${book.display_name ?? book.remote_id}:`,
          err,
        );
      }
    }

    if (stored > 0) {
      window.dispatchEvent(new CustomEvent(CONTACTS_SYNC_DONE_EVENT));
    }
  } catch (err) {
    console.warn(`[contactSync] Contact sync failed for account ${accountId}:`, err);
  }
}

/**
 * Sync one book, returning how many cards it stored.
 *
 * A book whose ctag still matches is skipped without fetching: the ctag
 * changes on any change to any card in the collection, which is what makes a
 * poll cheap on the common case of nothing having happened.
 */
async function syncAddressBook(
  provider: ContactsProvider,
  book: DbAddressBook,
  remote: AddressBookInfo | undefined,
): Promise<number> {
  if (remote?.ctag && book.ctag && remote.ctag === book.ctag) return 0;

  const result = await provider.syncContacts(book.remote_id);

  const keptUids: string[] = [];
  for (const card of result.cards) {
    const uid = identityOf(card);
    keptUids.push(uid);
    const contactId = await storeCard(book, card, uid);
    await mergeLocalRows(provider, book, card, contactId);
  }

  // Only a fetch that actually returned removes anything. A failed one throws
  // before reaching this point, which matters: an empty list is taken as "the
  // book is empty" and would otherwise clear it.
  await deleteDavContactsMissingFrom(book.id, keptUids);
  await updateAddressBookSyncState(book.id, result.newCtag, result.newSyncToken);

  return result.cards.length;
}

/**
 * The identity a card is stored under.
 *
 * UID is the card's own (RFC 6350 §6.7.6) and survives being moved or renamed
 * on the server. Cards without one do turn up — an import from an old export,
 * usually — and for those the URL is the only stable handle there is.
 */
export function identityOf(card: ContactCardData): string {
  return card.uid?.trim() || card.remoteContactId;
}

/** Every address on a card, lower-cased and free of duplicates. */
export function addressesOf(card: ContactCardData): string[] {
  const seen = new Set<string>();
  for (const email of card.emails) {
    const normalized = normalizeEmail(email.address);
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

/** The address a card is filed under: the preferred one, else the first. */
export function primaryAddressOf(card: ContactCardData): string | null {
  const preferred = card.emails.find((e) => e.isPrimary) ?? card.emails[0];
  return preferred ? normalizeEmail(preferred.address) : null;
}

async function storeCard(
  book: DbAddressBook,
  card: ContactCardData,
  uid: string,
): Promise<string> {
  return upsertDavContact({
    addressBookId: book.id,
    davUid: uid,
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

/**
 * Fold the mail-derived rows for this card's addresses into the card.
 *
 * The note is the one field both sides may hold text in, and the local one is
 * the user's own writing — so it is carried onto the server before the row it
 * lives in goes. Should that write fail, the local row stays put and the merge
 * is retried on the next run; a note is worth more than a duplicate entry
 * costs.
 */
async function mergeLocalRows(
  provider: ContactsProvider,
  book: DbAddressBook,
  card: ContactCardData,
  contactId: string,
): Promise<void> {
  for (const address of addressesOf(card)) {
    const local = await findLocalContactByEmail(address);
    if (!local) continue;

    const localNote = local.notes?.trim();
    const cardNote = card.note?.trim() ?? "";

    if (localNote && localNote !== cardNote) {
      const merged = cardNote ? `${cardNote}\n\n${localNote}` : localNote;

      if (book.is_read_only === 1) {
        console.warn(
          `[contactSync] Keeping the local note for ${address}: ${book.display_name ?? book.remote_id} does not accept writes`,
        );
        continue;
      }

      try {
        const updated = await provider.updateContact(
          book.remote_id,
          card.remoteContactId,
          { note: merged },
          card.etag ?? undefined,
        );
        await updateDavContactCard(contactId, {
          vcardData: updated.vcardData,
          etag: null,
          displayName: updated.displayName,
          email: primaryAddressOf(updated),
          emails: addressesOf(updated),
          phones: updated.phones.map((p) => p.number),
          organization: updated.organization,
          jobTitle: updated.jobTitle,
          note: updated.note,
        });
      } catch (err) {
        console.warn(`[contactSync] Could not carry the note for ${address} over:`, err);
        continue;
      }
    }

    await absorbLocalContact(contactId, local.id);
  }
}
