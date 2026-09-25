import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

type EmptyStateProps = {
  title: string;
  subtitle?: string;
} & (
  | { icon: LucideIcon; illustration?: never }
  | { illustration: ComponentType<{ size?: number; className?: string }>; icon?: never }
);

export function EmptyState({ title, subtitle, ...rest }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-text-tertiary px-4">
      {"illustration" in rest && rest.illustration ? (
        <rest.illustration size={104} className="mb-5 opacity-70" />
      ) : "icon" in rest && rest.icon ? (
        (() => { const Icon = rest.icon; return <Icon size={32} strokeWidth={1.25} className="mb-3 opacity-60" />; })()
      ) : null}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {subtitle && <p className="text-xs mt-1 text-center text-text-tertiary">{subtitle}</p>}
    </div>
  );
}
