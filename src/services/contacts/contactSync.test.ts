import {
  addressesOf,
  identityOf,
  primaryAddressOf,
  syncContactsForAccount,
} from "./contactSync";
import { getContactsProvider, hasContactsSupport } from "./providerFactory";
import {
  getVisibleAddressBooks,
  updateAddressBookSyncState,
  upsertAddressBook,
} from "@/services/db/addressBooks";
import {
  absorbLocalContact,
  deleteDavContactsMissingFrom,
  findLocalContactByEmail,
  updateDavContactCard,
  upsertDavContact,
} from "@/services/db/contacts";
import type { ContactCardData } from "./types";

vi.mock("./providerFactory", () => ({
  getContactsProvider: vi.fn(),
  hasContactsSupport: vi.fn(),
}));

vi.mock("@/services/db/addressBooks", () => ({
  upsertAddressBook: vi.fn().mockResolvedValue("book-1"),
  getVisibleAddressBooks: vi.fn().mockResolvedValue([]),
  updateAddressBookSyncState: vi.fn(),
}));

vi.mock("@/services/db/contacts", () => ({
  upsertDavContact: vi.fn().mockResolvedValue("contact-1"),
  absorbLocalContact: vi.fn(),
  findLocalContactByEmail: vi.fn().mockResolvedValue(null),
  deleteDavContactsMissingFrom: vi.fn(),
  updateDavContactCard: vi.fn(),
}));

const card = (overrides: Partial<ContactCardData> = {}): ContactCardData => ({
  remoteContactId: "https://dav.example.org/books/default/anna.vcf",
  uid: "anna-1",
  etag: "etag-1",
  displayName: "Anna Mustermann",
  firstName: "Anna",
  lastName: "Mustermann",
  emails: [{ address: "Anna@Example.org", type: "WORK", isPrimary: true }],
  phones: [],
  addresses: [],
  organization: null,
  jobTitle: null,
  note: null,
  photoUrl: null,
  vcardData: "BEGIN:VCARD\r\nEND:VCARD",
  ...overrides,
});

const storedBook = (overrides: Record<string, unknown> = {}) => ({
  id: "book-1",
  account_id: "acc-1",
  provider: "carddav",
  remote_id: "https://dav.example.org/books/default/",
  display_name: "Kontakte",
  description: null,
  is_read_only: 0,
  is_visible: 1,
  sync_token: null,
  ctag: null,
  created_at: 0,
  updated_at: 0,
  ...overrides,
});

const remoteBook = (overrides: Record<string, unknown> = {}) => ({
  remoteId: "https://dav.example.org/books/default/",
  displayName: "Kontakte",
  description: null,
  isReadOnly: false,
  ctag: "ctag-1",
  syncToken: null,
  ...overrides,
});

function mockProvider(overrides: Record<string, unknown> = {}) {
  const provider = {
    accountId: "acc-1",
    type: "carddav" as const,
    listAddressBooks: vi.fn().mockResolvedValue([remoteBook()]),
    syncContacts: vi.fn().mockResolvedValue({
      cards: [card()],
      newCtag: "ctag-1",
      newSyncToken: null,
    }),
    fetchContacts: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
    testConnection: vi.fn(),
    ...overrides,
  };
  vi.mocked(getContactsProvider).mockResolvedValue(provider as never);
  return provider;
}

describe("syncContactsForAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasContactsSupport).mockResolvedValue(true);
    vi.mocked(getVisibleAddressBooks).mockResolvedValue([storedBook()] as never);
    vi.mocked(findLocalContactByEmail).mockResolvedValue(null);
    vi.mocked(upsertDavContact).mockResolvedValue("contact-1");
    vi.mocked(upsertAddressBook).mockResolvedValue("book-1");
  });

  it("does nothing for an account without CardDAV configured", async () => {
    vi.mocked(hasContactsSupport).mockResolvedValue(false);

    await syncContactsForAccount("acc-1");

    expect(getContactsProvider).not.toHaveBeenCalled();
  });

  it("records the books the server reports", async () => {
    mockProvider();

    await syncContactsForAccount("acc-1");

    expect(upsertAddressBook).toHaveBeenCalledWith({
      accountId: "acc-1",
      provider: "carddav",
      remoteId: "https://dav.example.org/books/default/",
      displayName: "Kontakte",
      description: null,
      isReadOnly: false,
    });
  });

  it("stores a card under its UID rather than its URL", async () => {
    mockProvider();

    await syncContactsForAccount("acc-1");

    expect(upsertDavContact).toHaveBeenCalledWith(
      expect.objectContaining({
        davUid: "anna-1",
        davHref: "https://dav.example.org/books/default/anna.vcf",
        addressBookId: "book-1",
        email: "anna@example.org",
        emails: ["anna@example.org"],
      }),
    );
  });

  it("falls back to the URL for a card that carries no UID", async () => {
    mockProvider({
      syncContacts: vi.fn().mockResolvedValue({
        cards: [card({ uid: null })],
        newCtag: null,
        newSyncToken: null,
      }),
    });

    await syncContactsForAccount("acc-1");

    expect(upsertDavContact).toHaveBeenCalledWith(
      expect.objectContaining({ davUid: "https://dav.example.org/books/default/anna.vcf" }),
    );
  });

  it("skips a book whose ctag has not moved", async () => {
    const provider = mockProvider();
    vi.mocked(getVisibleAddressBooks).mockResolvedValue([
      storedBook({ ctag: "ctag-1" }),
    ] as never);

    await syncContactsForAccount("acc-1");

    expect(provider.syncContacts).not.toHaveBeenCalled();
  });

  it("fetches a book whose ctag changed", async () => {
    const provider = mockProvider();
    vi.mocked(getVisibleAddressBooks).mockResolvedValue([
      storedBook({ ctag: "ctag-old" }),
    ] as never);

    await syncContactsForAccount("acc-1");

    expect(provider.syncContacts).toHaveBeenCalled();
  });

  it("skips a book the user switched off", async () => {
    const provider = mockProvider();
    vi.mocked(getVisibleAddressBooks).mockResolvedValue([]);

    await syncContactsForAccount("acc-1");

    expect(provider.syncContacts).not.toHaveBeenCalled();
  });

  it("removes the cards the server no longer lists", async () => {
    mockProvider();

    await syncContactsForAccount("acc-1");

    expect(deleteDavContactsMissingFrom).toHaveBeenCalledWith("book-1", ["anna-1"]);
  });

  it("leaves a book untouched when its fetch failed", async () => {
    mockProvider({ syncContacts: vi.fn().mockRejectedValue(new Error("503")) });

    await syncContactsForAccount("acc-1");

    // An error must not read as "the book is empty".
    expect(deleteDavContactsMissingFrom).not.toHaveBeenCalled();
  });

  it("records the ctag so the next run can skip the book", async () => {
    mockProvider();

    await syncContactsForAccount("acc-1");

    expect(updateAddressBookSyncState).toHaveBeenCalledWith("book-1", "ctag-1", null);
  });

  describe("merging a mail-derived row", () => {
    it("folds it into the card", async () => {
      mockProvider();
      vi.mocked(findLocalContactByEmail).mockResolvedValue({
        id: "local-1",
        notes: null,
      } as never);

      await syncContactsForAccount("acc-1");

      expect(absorbLocalContact).toHaveBeenCalledWith("contact-1", "local-1");
    });

    it("carries a local note onto the server before dropping the row", async () => {
      const provider = mockProvider();
      provider.updateContact.mockResolvedValue(
        card({ note: "Kennengelernt auf der Messe" }) as never,
      );
      vi.mocked(findLocalContactByEmail).mockResolvedValue({
        id: "local-1",
        notes: "Kennengelernt auf der Messe",
      } as never);

      await syncContactsForAccount("acc-1");

      expect(provider.updateContact).toHaveBeenCalledWith(
        "https://dav.example.org/books/default/",
        "https://dav.example.org/books/default/anna.vcf",
        { note: "Kennengelernt auf der Messe" },
        "etag-1",
      );
      expect(updateDavContactCard).toHaveBeenCalled();
      expect(absorbLocalContact).toHaveBeenCalledWith("contact-1", "local-1");
    });

    it("keeps both notes when the card already has one", async () => {
      const provider = mockProvider({
        syncContacts: vi.fn().mockResolvedValue({
          cards: [card({ note: "Vom Server" })],
          newCtag: null,
          newSyncToken: null,
        }),
      });
      provider.updateContact.mockResolvedValue(card() as never);
      vi.mocked(findLocalContactByEmail).mockResolvedValue({
        id: "local-1",
        notes: "Meine Notiz",
      } as never);

      await syncContactsForAccount("acc-1");

      expect(provider.updateContact.mock.calls[0]![2]).toEqual({
        note: "Vom Server\n\nMeine Notiz",
      });
    });

    it("writes nothing when the notes already agree", async () => {
      const provider = mockProvider({
        syncContacts: vi.fn().mockResolvedValue({
          cards: [card({ note: "Gleiche Notiz" })],
          newCtag: null,
          newSyncToken: null,
        }),
      });
      vi.mocked(findLocalContactByEmail).mockResolvedValue({
        id: "local-1",
        notes: "Gleiche Notiz",
      } as never);

      await syncContactsForAccount("acc-1");

      expect(provider.updateContact).not.toHaveBeenCalled();
      expect(absorbLocalContact).toHaveBeenCalled();
    });

    it("keeps the local row when the note could not be carried over", async () => {
      const provider = mockProvider();
      provider.updateContact.mockRejectedValue(new Error("412"));
      vi.mocked(findLocalContactByEmail).mockResolvedValue({
        id: "local-1",
        notes: "Meine Notiz",
      } as never);

      await syncContactsForAccount("acc-1");

      expect(absorbLocalContact).not.toHaveBeenCalled();
    });

    it("keeps the local row rather than writing to a read-only book", async () => {
      const provider = mockProvider();
      vi.mocked(getVisibleAddressBooks).mockResolvedValue([
        storedBook({ is_read_only: 1 }),
      ] as never);
      vi.mocked(findLocalContactByEmail).mockResolvedValue({
        id: "local-1",
        notes: "Meine Notiz",
      } as never);

      await syncContactsForAccount("acc-1");

      expect(provider.updateContact).not.toHaveBeenCalled();
      expect(absorbLocalContact).not.toHaveBeenCalled();
    });
  });
});

describe("card helpers", () => {
  it("identifies a card by UID, ignoring surrounding whitespace", () => {
    expect(identityOf(card({ uid: "  anna-1  " }))).toBe("anna-1");
  });

  it("falls back to the URL for a blank UID", () => {
    expect(identityOf(card({ uid: "   " }))).toBe(
      "https://dav.example.org/books/default/anna.vcf",
    );
  });

  it("lower-cases addresses and drops repeats", () => {
    expect(
      addressesOf(
        card({
          emails: [
            { address: "Anna@Example.org", type: null, isPrimary: true },
            { address: "anna@example.org", type: null, isPrimary: false },
            { address: "Zweit@Example.net", type: null, isPrimary: false },
          ],
        }),
      ),
    ).toEqual(["anna@example.org", "zweit@example.net"]);
  });

  it("files a card under its preferred address", () => {
    expect(
      primaryAddressOf(
        card({
          emails: [
            { address: "privat@example.net", type: null, isPrimary: false },
            { address: "Buero@Example.org", type: null, isPrimary: true },
          ],
        }),
      ),
    ).toBe("buero@example.org");
  });

  it("files a card with no address under none", () => {
    expect(primaryAddressOf(card({ emails: [] }))).toBeNull();
  });
});
