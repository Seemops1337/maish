import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock("@/services/db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/db/connection")>();
  return {
    ...actual,
    getDb: mockGetDb,
    // The real helper closes over connection.ts's own getDb, so it has to be
    // routed through the mock as well or it opens a database in the test run.
    selectFirstBy: async (query: string, params: unknown[] = []) => {
      const db = await mockGetDb();
      const rows = await db.select(query, params);
      return rows[0] ?? null;
    },
  };
});

import { getDb } from "@/services/db/connection";
import {
  getAllContacts, updateContact, deleteContact,
  updateContactNotes, getAttachmentsFromContact,
  getContactsFromSameDomain, getLatestAuthResult,
  upsertContact, upsertDavContact, absorbLocalContact,
  deleteDavContactsMissingFrom, getContactByEmail, searchContacts,
} from "./contacts";
import { createMockDb } from "@/test/mocks";

const mockDb = createMockDb();

describe("contacts service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  describe("getAllContacts", () => {
    it("calls db.select with correct SQL and default params", async () => {
      await getAllContacts();

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM contacts"),
        [500, 0],
      );
    });

    it("passes limit and offset params", async () => {
      await getAllContacts(100, 50);

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $1 OFFSET $2"),
        [100, 50],
      );
    });
  });

  describe("updateContact", () => {
    it("calls db.execute with correct SQL params", async () => {
      await updateContact("contact-123", "John Doe");

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE contacts SET display_name = $1"),
        ["John Doe", "contact-123"],
      );
    });
  });

  describe("deleteContact", () => {
    it("calls db.execute with correct SQL and id", async () => {
      await deleteContact("contact-456");

      expect(mockDb.execute).toHaveBeenCalledWith(
        "DELETE FROM contacts WHERE id = $1",
        ["contact-456"],
      );
    });
  });

  describe("updateContactNotes", () => {
    it("calls db.execute with correct SQL and normalized email", async () => {
      await updateContactNotes("John@Example.COM", "Great client");

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE contacts SET notes = $1"),
        ["Great client", "john@example.com"],
      );
    });

    it("stores null for empty notes", async () => {
      await updateContactNotes("user@test.com", "");

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE contacts SET notes = $1"),
        [null, "user@test.com"],
      );
    });
  });

  describe("getAttachmentsFromContact", () => {
    it("queries with correct JOIN and default limit", async () => {
      await getAttachmentsFromContact("sender@test.com");

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("FROM attachments a"),
        ["sender@test.com", 5],
      );
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("a.is_inline = 0"),
        expect.any(Array),
      );
    });

    it("passes custom limit", async () => {
      await getAttachmentsFromContact("sender@test.com", 10);

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.any(String),
        ["sender@test.com", 10],
      );
    });
  });

  describe("getContactsFromSameDomain", () => {
    it("queries contacts with same domain", async () => {
      await getContactsFromSameDomain("alice@company.com");

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("LIKE $1"),
        ["%@company.com", "alice@company.com", 5],
      );
    });

    it("returns empty array for public domains", async () => {
      const result = await getContactsFromSameDomain("user@gmail.com");

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("returns empty array for email without @", async () => {
      const result = await getContactsFromSameDomain("invalid-email");

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("getLatestAuthResult", () => {
    it("queries most recent auth_results", async () => {
      mockDb.select.mockResolvedValueOnce([{ auth_results: '{"aggregate":"pass"}' }]);

      const result = await getLatestAuthResult("sender@test.com");

      expect(result).toBe('{"aggregate":"pass"}');
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("auth_results FROM messages"),
        ["sender@test.com"],
      );
    });

    it("returns null when no results", async () => {
      mockDb.select.mockResolvedValueOnce([]);

      const result = await getLatestAuthResult("unknown@test.com");

      expect(result).toBeNull();
    });
  });
});

describe("contact origins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  describe("upsertContact", () => {
    it("bumps the synced card that already claims the address", async () => {
      mockDb.select.mockResolvedValueOnce([
        { id: "card-1", address_book_id: "book-1", frequency: 3 },
      ] as never);

      await upsertContact("Anna@Example.org", "Someone Else");

      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("frequency = frequency + 1"),
        ["card-1"],
      );
      // The server owns the name; a mail header must not overwrite it.
      expect(mockDb.execute.mock.calls[0]![0]).not.toContain("display_name");
    });

    it("finds the card by a secondary address too", async () => {
      mockDb.select.mockResolvedValueOnce([{ id: "card-1" }] as never);

      await upsertContact("zweit@example.net", null);

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("dav_emails LIKE $2"),
        ["zweit@example.net", '%"zweit@example.net"%'],
      );
    });

    it("creates a local row when no card claims the address", async () => {
      mockDb.select.mockResolvedValueOnce([] as never);

      await upsertContact("neu@example.org", "Neu");

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO contacts"),
        [expect.any(String), "neu@example.org", "Neu"],
      );
    });

    it("targets the partial index, which is the only uniqueness left", async () => {
      mockDb.select.mockResolvedValueOnce([] as never);

      await upsertContact("neu@example.org", null);

      expect(mockDb.execute.mock.calls[0]![0]).toContain(
        "ON CONFLICT(email) WHERE address_book_id IS NULL",
      );
    });
  });

  describe("upsertDavContact", () => {
    const fields = {
      addressBookId: "book-1",
      davUid: "anna-1",
      davHref: "https://dav.example.org/books/default/anna.vcf",
      davEtag: "etag-1",
      vcardData: "BEGIN:VCARD\r\nEND:VCARD",
      displayName: "Anna Mustermann",
      email: "anna@example.org",
      emails: ["anna@example.org", "zweit@example.net"],
      phones: ["+43 1 234"],
      organization: "Beispiel GmbH",
      jobTitle: "Leiterin",
      note: "Vom Server",
      avatarUrl: null,
    };

    it("keys the card on its book and UID", async () => {
      mockDb.select.mockResolvedValueOnce([{ id: "card-1" }] as never);

      await upsertDavContact(fields);

      expect(mockDb.execute.mock.calls[0]![0]).toContain(
        "ON CONFLICT(address_book_id, dav_uid)",
      );
    });

    it("stores every address as JSON so a secondary one stays searchable", async () => {
      mockDb.select.mockResolvedValueOnce([{ id: "card-1" }] as never);

      await upsertDavContact(fields);

      expect(mockDb.execute.mock.calls[0]![1]).toContain(
        '["anna@example.org","zweit@example.net"]',
      );
    });

    it("leaves the usage counters alone, which no server knows", async () => {
      mockDb.select.mockResolvedValueOnce([{ id: "card-1" }] as never);

      await upsertDavContact(fields);

      const sql = mockDb.execute.mock.calls[0]![0] as string;
      const update = sql.slice(sql.indexOf("DO UPDATE"));
      expect(update).not.toContain("frequency");
      expect(update).not.toContain("last_contacted_at");
    });

    it("returns the id the row already had", async () => {
      mockDb.select.mockResolvedValueOnce([{ id: "existing-card" }] as never);

      expect(await upsertDavContact(fields)).toBe("existing-card");
    });
  });

  describe("absorbLocalContact", () => {
    it("adds the mail history to the card and drops the duplicate row", async () => {
      mockDb.select.mockResolvedValueOnce([
        { id: "card-1", frequency: 2, last_contacted_at: 100, first_contacted_at: 50 },
        { id: "local-1", frequency: 5, last_contacted_at: 300, first_contacted_at: 20 },
      ] as never);

      await absorbLocalContact("card-1", "local-1");

      expect(mockDb.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("UPDATE contacts SET frequency = $1"),
        [7, 300, 20, "card-1"],
      );
      expect(mockDb.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("DELETE FROM contacts WHERE id = $1 AND address_book_id IS NULL"),
        ["local-1"],
      );
    });

    it("copes with a local row that was never dated", async () => {
      mockDb.select.mockResolvedValueOnce([
        { id: "card-1", frequency: 1, last_contacted_at: null, first_contacted_at: null },
        { id: "local-1", frequency: 1, last_contacted_at: 400, first_contacted_at: null },
      ] as never);

      await absorbLocalContact("card-1", "local-1");

      expect(mockDb.execute.mock.calls[0]![1]).toEqual([2, 400, null, "card-1"]);
    });

    it("does nothing when one of the two rows is gone", async () => {
      mockDb.select.mockResolvedValueOnce([{ id: "card-1", frequency: 1 }] as never);

      await absorbLocalContact("card-1", "local-1");

      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe("deleteDavContactsMissingFrom", () => {
    it("keeps the cards the server still lists", async () => {
      await deleteDavContactsMissingFrom("book-1", ["a", "b"]);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("dav_uid NOT IN ($2, $3)"),
        ["book-1", "a", "b"],
      );
    });

    it("clears the book when the server lists nothing", async () => {
      await deleteDavContactsMissingFrom("book-1", []);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM contacts WHERE address_book_id = $1"),
        ["book-1"],
      );
    });
  });

  describe("getContactByEmail", () => {
    it("prefers the synced card over the row mail alone produced", async () => {
      await getContactByEmail("anna@example.org");

      const [sql, params] = mockDb.select.mock.calls[0]!;
      expect(sql).toContain("ORDER BY address_book_id IS NULL");
      expect(params).toEqual(["anna@example.org", '%"anna@example.org"%']);
    });
  });

  describe("searchContacts", () => {
    it("matches a secondary address of a synced card", async () => {
      await searchContacts("zweit");

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("dav_emails LIKE $1"),
        ["%zweit%", 10],
      );
    });
  });
});
