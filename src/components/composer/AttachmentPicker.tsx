import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { useComposerStore, type ComposerAttachment } from "@/stores/composerStore";
import { readFileAsBase64 } from "@/utils/fileUtils";
import { formatFileSize } from "@/utils/fileTypeHelpers";

const MAX_TOTAL_SIZE = 24 * 1024 * 1024; // 24MB

export function AttachmentPicker() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attachments = useComposerStore((s) => s.attachments);
  const addAttachment = useComposerStore((s) => s.addAttachment);
  const removeAttachment = useComposerStore((s) => s.removeAttachment);

  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        console.warn("Attachment size limit exceeded (24MB)");
        break;
      }
      const content = await readFileAsBase64(file);
      const attachment: ComposerAttachment = {
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        content,
      };
      addAttachment(attachment);
    }
    // Reset input so re-selecting the same file works
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="px-4 py-1.5">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 h-7 px-2 -ml-2 rounded-md text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="Attach files"
        >
          <Paperclip size={14} />
          <span>Attach</span>
        </button>

        {attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md border border-border-primary bg-bg-secondary text-xs"
          >
            <span className="text-text-primary truncate max-w-[150px]">
              {att.filename}
            </span>
            <span className="font-mono tabular-nums text-text-tertiary">
              {formatFileSize(att.size)}
            </span>
            <button
              onClick={() => removeAttachment(att.id)}
              className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {attachments.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-text-tertiary">
            {formatFileSize(totalSize)} total
          </span>
        )}
      </div>
    </div>
  );
}
