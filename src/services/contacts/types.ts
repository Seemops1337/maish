export type ContactsProviderType = "carddav";

export interface AddressBookInfo {
  /** Collection URL, which is what every later request addresses. */
  remoteId: string;
  displayName: string;
  description: string | null;
  /** No write privilege reported for this collection. */
  isReadOnly: boolean;
  ctag: string | null;
  syncToken: string | null;
}

export interface ContactEmail {
  address: string;
  /** WORK, HOME, … as the card states it, or null. */
  type: string | null;
  isPrimary: boolean;
}

export interface ContactPhone {
  number: string;
  type: string | null;
}

export interface ContactAddress {
  street: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  type: string | null;
}

/** A vCard as read from the server. */
export interface ContactCardData {
  /** Object URL on the server; the identity a request uses. */
  remoteContactId: string;
  /** The card's own UID (RFC 6350 §6.7.6), stable across a rename. */
  uid: string | null;
  etag: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  emails: ContactEmail[];
  phones: ContactPhone[];
  addresses: ContactAddress[];
  organization: string | null;
  jobTitle: string | null;
  note: string | null;
  /** A data: URI built from an embedded photo, or the URL the card points at. */
  photoUrl: string | null;
  /** The card verbatim, so an edit can patch it instead of rebuilding it. */
  vcardData: string;
}

/** The fields a new card is built from. */
export interface CreateContactInput {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  emails?: ContactEmail[];
  phones?: ContactPhone[];
  organization?: string | null;
  jobTitle?: string | null;
  note?: string | null;
}

/**
 * Fields an edit changes. An absent key leaves the card's property alone,
 * which is what keeps a form that never showed a property from deleting it;
 * null removes the property.
 */
export interface ContactEdits {
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  emails?: ContactEmail[];
  phones?: ContactPhone[];
  organization?: string | null;
  jobTitle?: string | null;
  note?: string | null;
}

export interface ContactsSyncResult {
  cards: ContactCardData[];
  newCtag: string | null;
  newSyncToken: string | null;
}

export interface ContactsProvider {
  readonly accountId: string;
  readonly type: ContactsProviderType;

  listAddressBooks(): Promise<AddressBookInfo[]>;
  fetchContacts(addressBookRemoteId: string): Promise<ContactCardData[]>;
  createContact(addressBookRemoteId: string, input: CreateContactInput): Promise<ContactCardData>;
  updateContact(
    addressBookRemoteId: string,
    remoteContactId: string,
    edits: ContactEdits,
    etag?: string,
  ): Promise<ContactCardData>;
  deleteContact(remoteContactId: string, etag?: string): Promise<void>;
  syncContacts(addressBookRemoteId: string): Promise<ContactsSyncResult>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}
