import { Search, X } from "lucide-react";

interface HelpSearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

export function HelpSearchBar({ query, onChange }: HelpSearchBarProps) {
  return (
    <div className="relative mb-5">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search help topics..."
        className="w-full pl-9 pr-9 h-9 text-sm rounded-md bg-bg-primary border border-border-primary text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary focus:ring-2 focus:ring-text-primary/10 transition-shadow"
      />
      {query && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
