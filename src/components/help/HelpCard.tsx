import { ChevronRight } from "lucide-react";
import { navigateToSettings } from "@/router/navigate";
import type { HelpCard as HelpCardData } from "@/constants/helpContent";

interface HelpCardProps {
  card: HelpCardData;
  isExpanded: boolean;
  onToggle: () => void;
}

export function HelpCard({ card, isExpanded, onToggle }: HelpCardProps) {
  const Icon = card.icon;

  return (
    <div className="rounded-md border border-border-primary bg-bg-primary overflow-hidden">
      {/* Collapsed header: icon + title + summary + chevron */}
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full p-4 text-left cursor-pointer transition-colors hover:bg-bg-hover"
      >
        <div className="w-8 h-8 rounded-md border border-border-primary bg-bg-secondary text-text-secondary flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary">{card.title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5 truncate">{card.summary}</p>
        </div>
        <ChevronRight
          size={14}
          className={`shrink-0 text-text-tertiary transition-transform duration-200 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Expanded body: description + tips + settings link */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pl-15 border-t border-border-secondary pt-3 space-y-3">
            <p className="text-[13px] text-text-secondary leading-relaxed">
              {card.description}
            </p>

            {card.tips && card.tips.length > 0 && (
              <ul className="space-y-1.5">
                {card.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                    <span aria-hidden="true" className="w-1 h-1 mt-1.5 rounded-full bg-text-tertiary shrink-0" />
                    <span className="flex-1">{tip.text}</span>
                    {tip.shortcut && (
                      <kbd className="shrink-0 font-mono text-[11px] leading-none px-1.5 py-1 rounded border border-border-primary bg-bg-secondary text-text-tertiary">
                        {tip.shortcut}
                      </kbd>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {card.relatedSettingsTab && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToSettings(card.relatedSettingsTab!);
                }}
                className="text-xs font-medium text-text-primary underline underline-offset-2 decoration-border-primary hover:decoration-text-primary transition-colors"
              >
                Open in Settings &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
