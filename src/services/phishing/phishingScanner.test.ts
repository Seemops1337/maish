import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanMessageLinks } from "./phishingScanner";
import { scanMessage } from "@/utils/phishingDetector";

const mockGetSetting = vi.fn();
const mockIsAllowlisted = vi.fn();
const mockGetCached = vi.fn();
const mockCache = vi.fn();

vi.mock("@/services/db/settings", () => ({
  getSetting: (key: string) => mockGetSetting(key),
}));

vi.mock("@/services/db/phishingAllowlist", () => ({
  isPhishingAllowlisted: (accountId: string, sender: string) =>
    mockIsAllowlisted(accountId, sender),
}));

vi.mock("@/services/db/linkScanResults", () => ({
  getCachedScanResult: (accountId: string, messageId: string) =>
    mockGetCached(accountId, messageId),
  cacheScanResult: (accountId: string, messageId: string, json: string) =>
    mockCache(accountId, messageId, json),
}));

/** Score 30 — above the "high" threshold (20), below "default" (40). */
const HTML_30 = `<a href="https://bit.ly/login">Click</a>`;
/** Score 55 — above "default" (40), below "low" (60). */
const HTML_55 = `<a href="http://192.168.1.1/login">Click</a>`;

function settings(overrides: Record<string, string | null> = {}) {
  const values: Record<string, string | null> = {
    phishing_detection_enabled: "true",
    phishing_sensitivity: "default",
    ...overrides,
  };
  mockGetSetting.mockImplementation((key: string) => Promise.resolve(values[key] ?? null));
}

describe("scanMessageLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings();
    mockIsAllowlisted.mockResolvedValue(false);
    mockGetCached.mockResolvedValue(null);
    mockCache.mockResolvedValue(undefined);
  });

  it("returns null when the feature is switched off", async () => {
    settings({ phishing_detection_enabled: "false" });

    const scan = await scanMessageLinks("a1", "m1", HTML_55, "bob@example.com");

    expect(scan).toBeNull();
    expect(mockCache).not.toHaveBeenCalled();
  });

  it("returns null when the sender is on the phishing allowlist", async () => {
    mockIsAllowlisted.mockResolvedValue(true);

    const scan = await scanMessageLinks("a1", "m1", HTML_55, "bob@example.com");

    expect(scan).toBeNull();
    expect(mockIsAllowlisted).toHaveBeenCalledWith("a1", "bob@example.com");
  });

  it("scans and caches a message that has not been seen before", async () => {
    const scan = await scanMessageLinks("a1", "m1", HTML_55, "bob@example.com");

    expect(scan?.result.showBanner).toBe(true);
    expect(scan?.result.links).toHaveLength(1);
    expect(mockCache).toHaveBeenCalledTimes(1);
    const [accountId, messageId, json] = mockCache.mock.calls[0]!;
    expect(accountId).toBe("a1");
    expect(messageId).toBe("m1");
    expect(JSON.parse(json).links).toHaveLength(1);
  });

  it("reuses a cached result instead of rescanning", async () => {
    mockGetCached.mockResolvedValue(JSON.stringify(scanMessage("m1", HTML_55, "default")));

    const scan = await scanMessageLinks("a1", "m1", HTML_55, "bob@example.com");

    expect(scan?.result.links).toHaveLength(1);
    expect(mockCache).not.toHaveBeenCalled();
  });

  it("rescans when the cache entry is unusable", async () => {
    mockGetCached.mockResolvedValue("not json");

    const scan = await scanMessageLinks("a1", "m1", HTML_55, "bob@example.com");

    expect(scan?.result.links).toHaveLength(1);
    expect(mockCache).toHaveBeenCalledTimes(1);
  });

  it("applies the current sensitivity to a fresh scan", async () => {
    settings({ phishing_sensitivity: "high" });

    const scan = await scanMessageLinks("a1", "m1", HTML_30, "bob@example.com");

    expect(scan?.result.showBanner).toBe(true);
  });

  it("applies the current sensitivity to a cached result", async () => {
    // Cached while sensitivity was "low", where this message shows no banner
    mockGetCached.mockResolvedValue(JSON.stringify(scanMessage("m1", HTML_30, "low")));
    settings({ phishing_sensitivity: "high" });

    const scan = await scanMessageLinks("a1", "m1", HTML_30, "bob@example.com");

    expect(scan?.result.showBanner).toBe(true);
  });

  it("falls back to the default sensitivity for an unknown setting value", async () => {
    settings({ phishing_sensitivity: "paranoid" });

    const scan = await scanMessageLinks("a1", "m1", HTML_30, "bob@example.com");

    expect(scan?.result.showBanner).toBe(false);
  });

  it("reports links worth confirming at the current sensitivity", async () => {
    settings({ phishing_sensitivity: "high" });

    const scan = await scanMessageLinks("a1", "m1", HTML_30, "bob@example.com");

    expect(scan?.riskyLinks.map((l) => l.url)).toEqual(["https://bit.ly/login"]);
  });

  it("reports no risky links when every link stays below the threshold", async () => {
    settings({ phishing_sensitivity: "low" });

    const scan = await scanMessageLinks("a1", "m1", HTML_30, "bob@example.com");

    expect(scan?.riskyLinks).toEqual([]);
    expect(scan?.result.showBanner).toBe(false);
  });

  it("scans a message without a sender address", async () => {
    const scan = await scanMessageLinks("a1", "m1", HTML_55, null);

    expect(mockIsAllowlisted).not.toHaveBeenCalled();
    expect(scan?.result.showBanner).toBe(true);
  });

  it("returns an empty scan for a message with no HTML body", async () => {
    const scan = await scanMessageLinks("a1", "m1", null, "bob@example.com");

    expect(scan?.result.links).toEqual([]);
    expect(scan?.result.showBanner).toBe(false);
    expect(scan?.riskyLinks).toEqual([]);
  });

  it("still returns the scan when caching fails", async () => {
    mockCache.mockRejectedValue(new Error("db is gone"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const scan = await scanMessageLinks("a1", "m1", HTML_55, "bob@example.com");

    expect(scan?.result.showBanner).toBe(true);
    errorSpy.mockRestore();
  });
});
