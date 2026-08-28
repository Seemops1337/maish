import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSelect = vi.fn(() => Promise.resolve([]));

vi.mock("./connection", () => ({
  getDb: () => Promise.resolve({ select: mockSelect }),
}));

import { searchMessages } from "./search";

/**
 * Searching for an address is the ordinary case — it is what the from: and to:
 * operators exist for — and it used to raise "fts5: syntax error near \"@\"".
 * SearchBar catches that and sets the thread-id filter to null, which
 * EmailList reads as "no search running", so the user was shown the unfiltered
 * mailbox and had no way to tell it apart from a result.
 */
describe("searchMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes an email address to MATCH as a quoted phrase", async () => {
    await searchMessages("simon@hochreiner.xyz", "acct-1");

    expect(mockSelect).toHaveBeenCalledTimes(1);
    const params = mockSelect.mock.calls[0]![1] as unknown[];
    expect(params[0]).toBe('"simon@hochreiner.xyz"');
  });

  it("quotes free text on the account-less path too", async () => {
    await searchMessages("o'brien");

    const params = mockSelect.mock.calls[0]![1] as unknown[];
    expect(params[0]).toBe(`"o'brien"`);
  });

  it("keeps several words an AND rather than a phrase", async () => {
    await searchMessages("quarterly report");

    const params = mockSelect.mock.calls[0]![1] as unknown[];
    expect(params[0]).toBe('"quarterly" "report"');
  });

  it("quotes the free text left over beside a search operator", async () => {
    await searchMessages("is:unread simon@hochreiner.xyz");

    const params = mockSelect.mock.calls[0]![1] as unknown[];
    expect(params).toContain('"simon@hochreiner.xyz"');
  });

  it("runs no query for a blank search", async () => {
    expect(await searchMessages("   ")).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
