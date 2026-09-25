import { SHORTCUTS } from "@/constants/shortcuts";
import { useShortcutStore } from "@/stores/shortcutStore";
import { Modal } from "@/components/ui/Modal";

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const KBD_CLASS =
  "font-mono text-[11px] leading-none px-1.5 py-1 rounded border border-border-primary bg-bg-secondary text-text-tertiary";

/** Render "g then i" as two keys joined by a quiet "then". */
function Keys({ keys }: { keys: string }) {
  const parts = keys.split(" then ");
  return (
    <span className="flex items-center gap-1 shrink-0">
      {parts.map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[11px] text-text-tertiary">then</span>}
          <kbd className={KBD_CLASS}>{key}</kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const keyMap = useShortcutStore((s) => s.keyMap);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" width="w-full max-w-2xl" zIndex="z-[60]">
      <div className="px-5 py-4 max-h-[60vh] overflow-y-auto columns-1 sm:columns-2 gap-8">
        {SHORTCUTS.map((section) => (
          <div key={section.category} className="break-inside-avoid mb-5">
            <h3 className="label-mono mb-1.5">
              {section.category}
            </h3>
            <div>
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 h-8 border-b border-border-secondary last:border-b-0"
                >
                  <span className="text-[13px] text-text-secondary truncate">
                    {item.desc}
                  </span>
                  <Keys keys={keyMap[item.id] ?? item.keys} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
