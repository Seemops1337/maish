import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { InputDialog } from "@/components/ui/InputDialog";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Sparkles,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleAiAssist?: () => void;
  aiAssistOpen?: boolean;
}

export function EditorToolbar({ editor, onToggleAiAssist, aiAssistOpen }: EditorToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  if (!editor) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editor.chain().focus().setImage({ src: dataUrl }).run();
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const btn = (
    Icon: LucideIcon,
    label: string,
    isActive: boolean,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={`p-1.5 rounded-md transition-colors ${
        isActive
          ? "bg-bg-selected text-text-primary"
          : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
      }`}
    >
      <Icon size={16} />
    </button>
  );

  const divider = <div className="w-px h-4 bg-border-primary mx-1" />;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 border-b border-border-primary bg-bg-primary flex-wrap">
      {btn(Bold, "Bold (Ctrl+B)", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run())}
      {btn(Italic, "Italic (Ctrl+I)", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run())}
      {btn(Underline, "Underline (Ctrl+U)", editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run())}
      {btn(Strikethrough, "Strikethrough", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run())}

      {divider}

      {btn(Heading1, "Heading 1", editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn(Heading2, "Heading 2", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn(Heading3, "Heading 3", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}

      {divider}

      {btn(List, "Bullet list", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run())}
      {btn(ListOrdered, "Numbered list", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run())}
      {btn(Quote, "Quote", editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run())}
      {btn(Code, "Code block", editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run())}

      {divider}

      {btn(Minus, "Horizontal rule", false, () => editor.chain().focus().setHorizontalRule().run())}
      {btn(Link, "Link", editor.isActive("link"), () => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          setShowLinkDialog(true);
        }
      })}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      {btn(ImageIcon, "Insert image", false, () => imageInputRef.current?.click())}

      <div className="flex-1" />

      {onToggleAiAssist && (
        <button
          type="button"
          onClick={onToggleAiAssist}
          title="AI Assist"
          className={`h-7 px-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            aiAssistOpen
              ? "bg-bg-selected text-text-primary"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
          }`}
        >
          <Sparkles size={14} />
          AI
        </button>
      )}

      {btn(Undo2, "Undo", false, () => editor.chain().focus().undo().run())}
      {btn(Redo2, "Redo", false, () => editor.chain().focus().redo().run())}
      <InputDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onSubmit={(values) => {
          if (values.url) {
            editor.chain().focus().setLink({ href: values.url }).run();
          }
        }}
        title="Insert Link"
        fields={[{ key: "url", label: "URL", placeholder: "https://..." }]}
        submitLabel="Insert"
      />
    </div>
  );
}
