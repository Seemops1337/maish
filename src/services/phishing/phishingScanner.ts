import { scanMessage, applySensitivity, shouldConfirmLink } from "@/utils/phishingDetector";
import type { LinkAnalysis, MessageScanResult, PhishingSensitivity } from "@/utils/phishingDetector";
import { getSetting } from "@/services/db/settings";
import { isPhishingAllowlisted } from "@/services/db/phishingAllowlist";
import { getCachedScanResult, cacheScanResult } from "@/services/db/linkScanResults";
import { linkifyPlainText } from "@/utils/linkify";

/**
 * Bumped whenever a change alters what a scan of the same message would find.
 * The cache is keyed by message alone, so an entry written by an older scanner
 * would otherwise stand for good — and the entries written before plain-text
 * bodies were scanned record no links for messages that have them.
 */
const SCAN_VERSION = 2;

interface CachedScan {
  v: number;
  result: MessageScanResult;
}

export interface MessagePhishingScan {
  /** Scan result, with the banner decision made at the current sensitivity. */
  result: MessageScanResult;
  /** Links risky enough to confirm before opening, at the current sensitivity. */
  riskyLinks: LinkAnalysis[];
}

async function getPhishingSensitivity(): Promise<PhishingSensitivity> {
  const raw = await getSetting("phishing_sensitivity");
  return raw === "low" || raw === "high" ? raw : "default";
}

/**
 * Orchestrates phishing link scanning for a message.
 *
 * Flow:
 * 1. Check if feature is enabled (setting: phishing_detection_enabled)
 * 2. Check if sender is in the allowlist
 * 3. Check cache for existing result
 * 4. Scan the message body
 * 5. Cache the result
 *
 * The cache stores link scores, which are independent of the sensitivity
 * setting; the thresholds are applied afterwards, so changing the setting takes
 * effect on already-scanned messages too.
 */
export async function scanMessageLinks(
  accountId: string,
  messageId: string,
  bodyHtml: string | null,
  senderAddress: string | null,
  bodyText?: string | null,
): Promise<MessagePhishingScan | null> {
  // 1. Check if phishing detection is enabled
  const enabled = await getSetting("phishing_detection_enabled");
  if (enabled === "false") {
    return null;
  }

  // 2. Check if sender is allowlisted
  if (senderAddress) {
    const allowlisted = await isPhishingAllowlisted(accountId, senderAddress);
    if (allowlisted) {
      return null;
    }
  }

  const sensitivity = await getPhishingSensitivity();

  // 3. Check cache
  const cached = await getCachedScanResult(accountId, messageId);
  if (cached) {
    try {
      const entry = JSON.parse(cached) as CachedScan;
      if (entry.v === SCAN_VERSION && entry.result) {
        return withSensitivity(entry.result, sensitivity);
      }
      // Anything older was produced by a scanner that looked at less than
      // this one does; rescan rather than trust it.
    } catch {
      // Invalid cache entry — proceed with fresh scan
    }
  }

  // 4. Scan the message. A message with no HTML part is not link-free: the
  // renderer runs its plain-text body through linkifyPlainText and shows the
  // anchors that produces, so the same body is linkified here and those are
  // the links that get scored. Passing body_html alone left every plain-text
  // message unscanned while its links stayed clickable.
  const scannable = bodyHtml && bodyHtml.length > 0
    ? bodyHtml
    : bodyText
      ? linkifyPlainText(bodyText)
      : null;

  const result = scanMessage(messageId, scannable, sensitivity);

  // 5. Cache the result
  try {
    const entry: CachedScan = { v: SCAN_VERSION, result };
    await cacheScanResult(accountId, messageId, JSON.stringify(entry));
  } catch (err) {
    console.error("Failed to cache phishing scan result:", err);
  }

  return withSensitivity(result, sensitivity);
}

function withSensitivity(
  result: MessageScanResult,
  sensitivity: PhishingSensitivity,
): MessagePhishingScan {
  return {
    result: applySensitivity(result, sensitivity),
    riskyLinks: result.links.filter((link) => shouldConfirmLink(link, sensitivity)),
  };
}
