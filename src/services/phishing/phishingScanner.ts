import { scanMessage, applySensitivity, shouldConfirmLink } from "@/utils/phishingDetector";
import type { LinkAnalysis, MessageScanResult, PhishingSensitivity } from "@/utils/phishingDetector";
import { getSetting } from "@/services/db/settings";
import { isPhishingAllowlisted } from "@/services/db/phishingAllowlist";
import { getCachedScanResult, cacheScanResult } from "@/services/db/linkScanResults";

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
 * 4. Scan the message HTML
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
      return withSensitivity(JSON.parse(cached) as MessageScanResult, sensitivity);
    } catch {
      // Invalid cache entry — proceed with fresh scan
    }
  }

  // 4. Scan the message
  const result = scanMessage(messageId, bodyHtml, sensitivity);

  // 5. Cache the result
  try {
    await cacheScanResult(accountId, messageId, JSON.stringify(result));
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
