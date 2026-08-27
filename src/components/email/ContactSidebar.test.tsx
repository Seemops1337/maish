import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactSidebar } from "./ContactSidebar";
import type { DbContact, ContactAttachment, SameDomainContact } from "@/services/db/contacts";

const mockContact: DbContact = {
  id: "c-1",
  email: "alice@company.com",
  display_name: "Alice Smith",
  avatar_url: null,
  frequency: 10,
  last_contacted_at: Date.now(),
  notes: "Important client",
};

vi.mock("@/services/db/contacts", () => ({
  getContactByEmail: vi.fn(() => Promise.resolve(null)),
  getContactStats: vi.fn(() =>
    Promise.resolve({ emailCount: 5, firstEmail: 1700000000000, lastEmail: 1700100000000 }),
  ),
  getRecentThreadsWithContact: vi.fn(() => Promise.resolve([])),
  upsertContact: vi.fn(() => Promise.resolve()),
  updateContact: vi.fn(() => Promise.resolve()),
  updateContactNotes: vi.fn(() => Promise.resolve()),
  getAttachmentsFromContact: vi.fn(() => Promise.resolve([])),
  getContactsFromSameDomain: vi.fn(() => Promise.resolve([])),
  getLatestAuthResult: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/services/contacts/contactActions", () => ({
  saveContact: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/db/notificationVips", () => ({
  isVipSender: vi.fn(() => Promise.resolve(false)),
  addVipSender: vi.fn(() => Promise.resolve()),
  removeVipSender: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/contacts/gravatar", () => ({
  fetchAndCacheGravatarUrl: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/services/db/threads", () => ({
  getThreadById: vi.fn(),
  getThreadLabelIds: vi.fn(),
}));

vi.mock("@/router/navigate", () => ({
  navigateToThread: vi.fn(),
}));

vi.mock("@/utils/fileTypeHelpers", () => ({
  formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
  getFileIcon: vi.fn(() => "\u{1F4CE}"),
}));

// Import mocked modules to configure per-test
import {
  getContactByEmail,
  getAttachmentsFromContact,
  getContactsFromSameDomain,
  getLatestAuthResult,
  updateContactNotes,
} from "@/services/db/contacts";
import { isVipSender } from "@/services/db/notificationVips";
import { saveContact } from "@/services/contacts/contactActions";

const defaultProps = {
  email: "alice@company.com",
  name: "Alice Smith",
  accountId: "acc-1",
  onClose: vi.fn(),
};

describe("ContactSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders quick action buttons (compose, copy, VIP)", async () => {
    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle("Send email")).toBeInTheDocument();
      expect(screen.getByTitle("Copy email")).toBeInTheDocument();
      expect(screen.getByTitle("Mark as VIP")).toBeInTheDocument();
    });
  });

  it("shows 'Add to Contacts' when contact does not exist", async () => {
    vi.mocked(getContactByEmail).mockResolvedValueOnce(null);

    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add to Contacts")).toBeInTheDocument();
    });
  });

  it("shows 'Edit name' when contact exists", async () => {
    vi.mocked(getContactByEmail).mockResolvedValueOnce(mockContact);

    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Edit name")).toBeInTheDocument();
    });
  });

  it("renders Notes section toggle when contact exists", async () => {
    vi.mocked(getContactByEmail).mockResolvedValueOnce(mockContact);

    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Notes")).toBeInTheDocument();
    });

    // Notes textarea should not be visible initially
    expect(screen.queryByPlaceholderText("Add a note...")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("Notes"));

    expect(screen.getByPlaceholderText("Add a note...")).toBeInTheDocument();
  });

  it("renders attachments section when data present", async () => {
    const mockAttachments: ContactAttachment[] = [
      { filename: "report.pdf", mime_type: "application/pdf", size: 1024, date: 1700000000000 },
    ];
    vi.mocked(getAttachmentsFromContact).mockResolvedValueOnce(mockAttachments);

    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Shared Files")).toBeInTheDocument();
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });
  });

  it("renders same-domain contacts section when data present", async () => {
    const mockDomainContacts: SameDomainContact[] = [
      { email: "bob@company.com", display_name: "Bob Jones", avatar_url: null },
    ];
    vi.mocked(getContactsFromSameDomain).mockResolvedValueOnce(mockDomainContacts);

    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("bob@company.com")).toBeInTheDocument();
    });
  });

  it("renders AuthBadge next to name when auth results present", async () => {
    const authJson = JSON.stringify({
      spf: { result: "pass", detail: null },
      dkim: { result: "pass", detail: null },
      dmarc: { result: "pass", detail: null },
      aggregate: "pass",
    });
    vi.mocked(getLatestAuthResult).mockResolvedValueOnce(authJson);

    const { container } = render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      const badge = container.querySelector("[aria-label='Authentication passed']");
      expect(badge).toBeInTheDocument();
    });
  });

  it("shows VIP star as filled when sender is VIP", async () => {
    vi.mocked(isVipSender).mockResolvedValueOnce(true);

    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle("Remove VIP")).toBeInTheDocument();
    });
  });

  it("does not show Notes section when contact does not exist", async () => {
    vi.mocked(getContactByEmail).mockResolvedValueOnce(null);

    render(<ContactSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add to Contacts")).toBeInTheDocument();
    });

    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });
});

/**
 * A contact synced from an address book belongs to the server: its name,
 * organisation and note live in the vCard, and contactSync writes what the
 * server holds over the local row. A note stored only in that row therefore
 * survives until the next sync and is then gone — which is the opposite of
 * what "Contacts have two origins" in CLAUDE.md describes, where a note the
 * user wrote is carried onto the server.
 */
describe("ContactSidebar — a note on a synced contact", () => {
  const syncedContact: DbContact = {
    ...mockContact,
    id: "c-dav",
    address_book_id: "book-1",
    dav_uid: "uid-1",
    dav_href: "/books/1/uid-1.vcf",
    notes: "",
  } as DbContact;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function openNotes(contact: DbContact) {
    vi.mocked(getContactByEmail).mockResolvedValueOnce(contact);
    render(<ContactSidebar {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Notes")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Notes"));
    return screen.getByPlaceholderText("Add a note...");
  }

  it("saves through the path that reaches the address book", async () => {
    const textarea = await openNotes(syncedContact);

    fireEvent.change(textarea, { target: { value: "Met at the conference" } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(saveContact).toHaveBeenCalledWith(
        expect.objectContaining({ id: "c-dav" }),
        { note: "Met at the conference" },
      );
    });
  });

  it("does not write the note only to the local row", async () => {
    const textarea = await openNotes(syncedContact);

    fireEvent.change(textarea, { target: { value: "Met at the conference" } });
    fireEvent.blur(textarea);

    await waitFor(() => expect(saveContact).toHaveBeenCalled());
    expect(updateContactNotes).not.toHaveBeenCalled();
  });

  it("still saves a mail-derived contact, which has no server to reach", async () => {
    const textarea = await openNotes(mockContact);

    fireEvent.change(textarea, { target: { value: "Local note" } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(saveContact).toHaveBeenCalledWith(
        expect.objectContaining({ id: "c-1" }),
        { note: "Local note" },
      );
    });
  });
});
