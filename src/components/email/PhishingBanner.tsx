import { ShieldAlert } from "lucide-react";
import type { MessageScanResult } from "@/utils/phishingDetector";

interface PhishingBannerProps {
  scanResult: MessageScanResult;
  onTrustSender: () => void;
}

export function PhishingBanner({ scanResult, onTrustSender }: PhishingBannerProps) {
  const isHigh = scanResult.maxRiskScore >= 60;

  const bgClass = isHigh
    ? "bg-danger/5 border-danger/30"
    : "bg-warning/5 border-warning/30";
  const textClass = isHigh ? "text-danger" : "text-warning";
  const iconClass = isHigh ? "text-danger" : "text-warning";
  const buttonClass = isHigh
    ? "text-danger border-danger/30 hover:bg-danger/10"
    : "text-warning border-warning/30 hover:bg-warning/10";

  return (
    <div className={`mb-3 px-3 py-2.5 rounded-md border ${bgClass} flex items-center gap-2.5`}>
      <ShieldAlert size={16} className={`shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textClass}`}>
          {isHigh ? "High risk" : "Suspicious"} links detected
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {scanResult.suspiciousLinkCount === 1
            ? "1 suspicious link found"
            : `${scanResult.suspiciousLinkCount} suspicious links found`}
          {" "}in this message. Be cautious before clicking any links.
        </p>
      </div>
      <button
        onClick={onTrustSender}
        className={`shrink-0 h-7 px-2.5 text-xs font-medium rounded-md border bg-bg-primary transition-colors ${buttonClass}`}
      >
        Trust this sender
      </button>
    </div>
  );
}
