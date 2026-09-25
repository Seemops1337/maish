import {
  File,
  FileArchive,
  FileHeadphone,
  FileImage,
  FileSpreadsheet,
  FileText,
  FilePlay,
  type LucideIcon,
} from "lucide-react";

function iconFor(mimeType: string | null): LucideIcon {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FilePlay;
  if (mimeType.startsWith("audio/")) return FileHeadphone;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive")) return FileArchive;
  return File;
}

/** Monochrome file-type glyph for attachment rows and cards. */
export function FileTypeIcon({
  mimeType,
  size = 16,
  className = "",
}: {
  mimeType: string | null;
  size?: number;
  className?: string;
}) {
  const Icon = iconFor(mimeType);
  return <Icon size={size} strokeWidth={1.5} className={`text-text-tertiary ${className}`} aria-hidden="true" />;
}
