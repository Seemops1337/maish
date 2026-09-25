import type { SendAsAlias } from "@/services/db/sendAsAliases";

interface FromSelectorProps {
  aliases: SendAsAlias[];
  selectedEmail: string;
  onChange: (alias: SendAsAlias) => void;
}

/**
 * Dropdown for selecting a send-as alias in the composer.
 * Only visible when more than one alias is available.
 */
export function FromSelector({ aliases, selectedEmail, onChange }: FromSelectorProps) {
  if (aliases.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 px-4 h-9">
      <span className="label-mono w-16 shrink-0">
        From
      </span>
      <select
        value={selectedEmail}
        onChange={(e) => {
          const alias = aliases.find((a) => a.email === e.target.value);
          if (alias) onChange(alias);
        }}
        className="flex-1 h-7 bg-transparent text-sm text-text-primary outline-none cursor-pointer hover:bg-bg-hover rounded-md px-1.5 -ml-1.5 border-none transition-colors"
      >
        {aliases.map((alias) => (
          <option key={alias.id} value={alias.email}>
            {alias.displayName
              ? `${alias.displayName} <${alias.email}>`
              : alias.email}
          </option>
        ))}
      </select>
    </div>
  );
}
