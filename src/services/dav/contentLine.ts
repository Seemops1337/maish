/**
 * The line format iCalendar and vCard share.
 *
 * RFC 5545 §3.1 and RFC 6350 §3.2 describe the same grammar: lines folded at 75
 * octets, a property name with optional parameters before the colon, and TEXT
 * values escaped with backslashes. Both formats are read here, and one parser
 * for both keeps a fix to the quoting or folding rules from having to be made
 * twice.
 *
 * vCard adds the group prefix — `item1.EMAIL:…`, which Apple Contacts writes to
 * tie a property to its `item1.X-ABLabel` — so the name is split on the first
 * dot. iCalendar property names contain no dots, which leaves that path
 * unreachable for calendar data.
 */

export interface ContentLine {
  /** Property name, upper-cased. */
  name: string;
  /** Group prefix without its dot, or null. vCard only. */
  group: string | null;
  /** Parameters, keys upper-cased and values unquoted. */
  params: Record<string, string>;
  /** Raw value, still escaped. */
  value: string;
}

/**
 * Undo line folding and split into lines, dropping empty ones.
 *
 * A continuation is CRLF followed by one space or tab; the linebreak and that
 * one whitespace character go, everything after it belongs to the line before.
 */
export function unfoldLines(data: string): string[] {
  const raw = data
    .replace(/\r\n[ \t]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "");
  return raw.split("\n").filter((l) => l.length > 0);
}

/**
 * Split "DTSTART;TZID=Europe/Vienna:20260930T180000" into name, parameters and
 * value. Quoted parameter values may contain both colons and semicolons —
 * ATTENDEE;CN="Doe, John";X-URL="http://x/":mailto:… is legal — so the split
 * has to track quoting rather than take the first separator it finds.
 */
export function parseContentLine(line: string): ContentLine | null {
  let inQuotes = false;
  let colon = -1;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }

  if (colon === -1) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = splitUnquoted(head, ";");
  const rawName = segments[0]?.trim().toUpperCase();
  if (!rawName) return null;

  const dot = rawName.indexOf(".");
  const group = dot === -1 ? null : rawName.slice(0, dot);
  const name = dot === -1 ? rawName : rawName.slice(dot + 1);
  if (!name) return null;

  const params: Record<string, string> = {};
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf("=");
    // vCard 2.1 writes a bare type as `EMAIL;INTERNET:…`. RFC 6350 §3.4 has
    // readers treat it as a TYPE value rather than discard it, which is what
    // keeps a 2.1 card's addresses from all looking untyped.
    if (eq === -1) {
      const bare = segment.trim();
      if (!bare) continue;
      params["TYPE"] = params["TYPE"] ? `${params["TYPE"]},${bare}` : bare;
      continue;
    }
    const key = segment.slice(0, eq).trim().toUpperCase();
    const raw = stripQuotes(segment.slice(eq + 1).trim());
    // A repeated parameter accumulates: TYPE=WORK;TYPE=VOICE means both.
    params[key] = params[key] ? `${params[key]},${raw}` : raw;
  }

  return { name, group, params, value };
}

/** Split on a separator that quoted sections are allowed to contain. */
export function splitUnquoted(text: string, separator: string): string[] {
  const out: string[] = [];
  let inQuotes = false;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === separator && !inQuotes) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }

  out.push(text.slice(start));
  return out;
}

export function stripQuotes(text: string): string {
  return text.replace(/^"(.*)"$/, "$1");
}

/**
 * Split a value on a separator the escape sequences are allowed to contain.
 *
 * A structured value such as `N:Mustermann;Anna-Lena` is split on unescaped
 * semicolons only: `N:von Trapp\;Maria` is one component whose text carries a
 * semicolon. Splitting on the raw character first would cut it in half.
 */
export function splitEscaped(text: string, separator: string): string[] {
  const out: string[] = [];
  let current = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      current += ch + text[i + 1];
      i++;
      continue;
    }
    if (ch === separator) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }

  out.push(current);
  return out;
}

export function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function unescapeText(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Fold a content line to 75 octets as RFC 5545 §3.1 and RFC 6350 §3.2 require.
 *
 * The limit counts octets, not characters, so a line is measured after UTF-8
 * encoding and never cut inside a multi-byte sequence — a break in the middle
 * of an umlaut would produce two invalid bytes. Servers do accept long lines,
 * but a PHOTO holding base64 image data runs to tens of kilobytes on one line,
 * and that is where tolerance tends to end.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let octets = 0;
  // The continuation's leading space counts toward the next line's 75.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      out.push(current);
      current = "";
      octets = 0;
      limit = 74;
    }
    current += char;
    octets += size;
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}
