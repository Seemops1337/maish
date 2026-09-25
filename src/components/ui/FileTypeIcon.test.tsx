import { render } from "@testing-library/react";
import { FileTypeIcon } from "./FileTypeIcon";

describe("FileTypeIcon", () => {
  it.each([
    ["image/png", "lucide-file-image"],
    ["video/mp4", "lucide-file-play"],
    ["audio/mpeg", "lucide-file-headphone"],
    ["application/pdf", "lucide-file-text"],
    ["application/vnd.ms-excel", "lucide-file-spreadsheet"],
    ["application/zip", "lucide-file-archive"],
    ["application/octet-stream", "lucide-file"],
    [null, "lucide-file"],
  ])("renders the %s glyph", (mime, iconClass) => {
    const { container } = render(<FileTypeIcon mimeType={mime} />);
    const svg = container.querySelector("svg")!;
    expect(svg.classList.contains(iconClass)).toBe(true);
  });
});
