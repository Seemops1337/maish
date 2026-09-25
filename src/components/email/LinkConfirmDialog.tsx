import { ShieldAlert, ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { LinkAnalysis } from "@/utils/phishingDetector";

interface LinkConfirmDialogProps {
  linkAnalysis: LinkAnalysis;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LinkConfirmDialog({ linkAnalysis, onCancel, onConfirm }: LinkConfirmDialogProps) {
  const isHigh = linkAnalysis.riskLevel === "high";
  const borderColor = isHigh ? "border-danger/30" : "border-warning/30";
  const headerBg = isHigh ? "bg-danger/5" : "bg-warning/5";
  const headerText = isHigh ? "text-danger" : "text-warning";

  const customHeader = (
    <div className={`px-4 py-3 ${headerBg} ${borderColor} border-b flex items-center gap-2 rounded-t-md`}>
      <ShieldAlert size={16} className={headerText} />
      <h2 className={`text-sm font-medium ${headerText}`}>
        {isHigh ? "High Risk Link" : "Suspicious Link"}
      </h2>
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title=""
      width="w-full max-w-md mx-4"
      zIndex="z-[200]"
      panelClassName={`${borderColor} rounded-md overflow-hidden`}
      renderHeader={customHeader}
    >
      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* URL display */}
        <div>
          <label className="label-mono block mb-1.5">Full URL</label>
          <div className="flex items-start gap-2 px-3 py-2 bg-bg-secondary border border-border-primary rounded-md">
            <ExternalLink size={14} className="text-text-tertiary shrink-0 mt-0.5" />
            <span className="text-xs text-text-primary break-all font-mono leading-relaxed">
              {linkAnalysis.url}
            </span>
          </div>
        </div>

        {/* Display text if different */}
        {linkAnalysis.displayText && (
          <div>
            <label className="label-mono block mb-1.5">Link text</label>
            <p className="text-[13px] text-text-secondary">
              {linkAnalysis.displayText}
            </p>
          </div>
        )}

        {/* Triggered rules */}
        {linkAnalysis.triggeredRules.length > 0 && (
          <div>
            <label className="label-mono block mb-1.5">
              Issues detected ({linkAnalysis.triggeredRules.length})
            </label>
            <ul className="space-y-1.5">
              {linkAnalysis.triggeredRules.map((rule) => (
                <li
                  key={rule.ruleId}
                  className="flex items-start gap-2 text-xs"
                >
                  <span
                    className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${
                      rule.score >= 50
                        ? "bg-danger"
                        : rule.score >= 30
                          ? "bg-warning"
                          : "bg-text-tertiary"
                    }`}
                  />
                  <div>
                    <span className="font-medium text-text-primary">
                      {rule.name}
                    </span>
                    <span className="font-mono tabular-nums text-text-tertiary ml-1">
                      ({rule.score}pts)
                    </span>
                    <p className="text-text-tertiary mt-0.5">{rule.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border-primary flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="h-8 px-3 text-sm font-medium bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={onConfirm}
          className="h-8 px-3 text-sm text-text-primary bg-bg-primary border border-border-primary rounded-md hover:bg-bg-hover transition-colors"
        >
          Open Anyway
        </button>
      </div>
    </Modal>
  );
}
