import { HELP_CATEGORIES } from "@/constants/helpContent";
import { navigateToHelp } from "@/router/navigate";

interface HelpSidebarProps {
  activeTopic: string;
}

export function HelpSidebar({ activeTopic }: HelpSidebarProps) {
  return (
    <nav className="w-52 border-r border-border-primary p-2 space-y-px overflow-y-auto shrink-0 bg-bg-secondary">
      {HELP_CATEGORIES.map((category) => {
        const Icon = category.icon;
        const isActive = activeTopic === category.id;
        return (
          <button
            key={category.id}
            onClick={() => navigateToHelp(category.id)}
            className={`flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md text-[13px] text-left transition-colors ${
              isActive
                ? "bg-bg-selected text-text-primary font-medium"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="truncate">{category.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
