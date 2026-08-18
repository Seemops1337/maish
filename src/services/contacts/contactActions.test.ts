import {
  createDavContact,
  removeDavContact,
  saveContact,
  saveDavContact,
} from "./contactActions";
import { getContactsProvider } from "./providerFactory";
import { getAddressBookById } from "@/services/db/addressBooks";
import {
  deleteContact,
  getContactById,
  updateContact,
  updateContactNotes,
  updateDavContactCard,
  upsertDavContact,
  type DbContact,
} from "@/services/db/contacts";
import type { ContactCardData } from "./types";

vi.mock("./providerFactory", () => ({ getContactsProvider: vi.fn() }));
vi.mock("@/services/db/addressBooks", () => ({ getAddressBookById: vi.fn() }));
vi.mock("@/services/db/contacts", () => ({
  getContactById: vi.fn(),
  upsertDavContact: vi.fn().mockResolvedValue("contact-1"),
  updateDavContactCard: vi.fn(),
  updateContact: vi.fn(),
  updateContactNotes: vi.fn(),
  deleteContact: vi.fn(),
}));

const card: ContactCardData = {
  remoteContactId: "https://dav.example.org/books/default/anna.vcf",
  uid: "anna-1",
  etag: "etag-2",
  displayName: "Anna Mustermann",
  firstName: "Anna",
  lastName: "Mustermann",
  emails: [{ address: "Anna@Example.org", type: "WORK", isPrimary: true }],
  phones: [{ number: "+43 1 234", type: "WORK" }],
  addresses: [],
  organization: "Beispiel GmbH",
  jobTitle: null,
  note: null,
  photoUrl: null,
  vcardData: "BEGIN:VCARD\r\nEND:VCARD",
};

const book = (overrides: Record<string, unknown> = {}) => ({
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

const syncedContact = (overrides: Partial<DbContact> = {}): DbContact =>
  ({
    id: "contact-1",
    email: "anna@example.org",
    display_name: "Anna Mustermann",
    avatar_url: null,
    frequency: 1,
    last_contacted_at: null,
    notes: null,
    source: "carddav",
    address_book_id: "book-1",
    dav_uid: "anna-1",
    dav_href: "https://dav.example.org/books/default/anna.vcf",
    dav_etag: "etag-1",
    vcard_data: "BEGIN:VCARD\r\nEND:VCARD",
    dav_emails: '["anna@example.org"]',
    dav_phones: "[]",
    organization: null,
    job_title: null,
    ...overrides,
  }) as DbContact;

function mockProvider(overrides: Record<string, unknown> = {}) {
  const provider = {
    createContact: vi.fn().mockResolvedValue(card),
    updateContact: vi.fn().mockResolvedValue(card),
    deleteContact: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  vi.mocked(getContactsProvider).mockResolvedValue(provider as never);
  return provider;
}

describe("createDavContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAddressBookById).mockResolvedValue(book() as never);
    vi.mocked(upsertDavContact).mockResolvedValue("contact-1");
  });

  it("writes to the server and stores what came back", async () => {
    const provider = mockProvider();

    const id = await createDavContact("book-1", { displayName: "Anna Mustermann" });

    expect(provider.createContact).toHaveBeenCalledWith(
      "https://dav.example.org/books/default/",
      { displayName: "Anna Mustermann" },
    );
    expect(upsertDavContact).toHaveBeenCalledWith(
      expect.objectContaining({
        addressBookId: "book-1",
        davUid: "anna-1",
        email: "anna@example.org",
        phones: ["+43 1 234"],
      }),
    );
    expect(id).toBe("contact-1");
  });

  it("refuses a read-only book before touching the server", async () => {
    const provider = mockProvider();
    vi.mocked(getAddressBookById).mockResolvedValue(book({ is_read_only: 1 }) as never);

    await expect(createDavContact("book-1", { displayName: "A" })).rejects.toThrow(
      /does not accept changes/,
    );
    expect(provider.createContact).not.toHaveBeenCalled();
  });

  it("fails on a book that is gone", async () => {
    mockProvider();
    vi.mocked(getAddressBookById).mockResolvedValue(null);

    await expect(createDavContact("book-1", { displayName: "A" })).rejects.toThrow(/not found/);
  });
});

describe("saveDavContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContactById).mockResolvedValue(syncedContact());
    vi.mocked(getAddressBookById).mockResolvedValue(book() as never);
  });

  it("sends the edit with the stored etag and records the result", async () => {
    const provider = mockProvider();

    await saveDavContact("contact-1", { displayName: "Anna M." });

    expect(provider.updateContact).toHaveBeenCalledWith(
      "https://dav.example.org/books/default/",
      "https://dav.example.org/books/default/anna.vcf",
      { displayName: "Anna M." },
      "etag-1",
    );
    expect(updateDavContactCard).toHaveBeenCalledWith(
      "contact-1",
      expect.objectContaining({ displayName: "Anna Mustermann", etag: "etag-2" }),
    );
  });

  it("stores nothing when the server refused the write", async () => {
    mockProvider({ updateContact: vi.fn().mockRejectedValue(new Error("412")) });

    await expect(saveDavContact("contact-1", { displayName: "Anna M." })).rejects.toThrow("412");
    expect(updateDavContactCard).not.toHaveBeenCalled();
  });

  it("refuses a contact that is only local", async () => {
    vi.mocked(getContactById).mockResolvedValue(
      syncedContact({ address_book_id: null, dav_href: null }),
    );

    await expect(saveDavContact("contact-1", { displayName: "A" })).rejects.toThrow(
      /not synced/,
    );
  });
});

describe("removeDavContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContactById).mockResolvedValue(syncedContact());
    vi.mocked(getAddressBookById).mockResolvedValue(book() as never);
  });

  it("deletes on the server before dropping the row", async () => {
    const provider = mockProvider();

    await removeDavContact("contact-1");

    expect(provider.deleteContact).toHaveBeenCalledWith(
      "https://dav.example.org/books/default/anna.vcf",
      "etag-1",
    );
    expect(deleteContact).toHaveBeenCalledWith("contact-1");
  });

  it("keeps the row when the server refused the delete", async () => {
    mockProvider({ deleteContact: vi.fn().mockRejectedValue(new Error("403")) });

    await expect(removeDavContact("contact-1")).rejects.toThrow("403");
    expect(deleteContact).not.toHaveBeenCalled();
  });
});

describe("saveContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContactById).mockResolvedValue(syncedContact());
    vi.mocked(getAddressBookById).mockResolvedValue(book() as never);
  });

  it("routes a synced contact through the server", async () => {
    const provider = mockProvider();

    await saveContact(syncedContact(), { displayName: "Anna M." });

    expect(provider.updateContact).toHaveBeenCalled();
    expect(updateContact).not.toHaveBeenCalled();
  });

  it("stores a mail-derived contact locally, with no server involved", async () => {
    const provider = mockProvider();
    const local = syncedContact({
      address_book_id: null,
      dav_href: null,
      source: "local",
    });

    await saveContact(local, { displayName: "Anna M.", note: "Notiz" });

    expect(provider.updateContact).not.toHaveBeenCalled();
    expect(updateContact).toHaveBeenCalledWith("contact-1", "Anna M.");
    expect(updateContactNotes).toHaveBeenCalledWith("anna@example.org", "Notiz");
  });
});
