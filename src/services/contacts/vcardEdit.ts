/**
 * In-place editing of a stored vCard.
 *
 * Rebuilding a card from the fields a form shows discards everything else it
 * carries — the photo, the birthday, related-name and social-profile
 * properties, the `X-ABLabel` lines Apple Contacts writes, the categories
 * another client filed it under. The same reasoning as for calendar objects
 * applies (`@/services/calendar/icalEdit`): patch the text that is there.
 *
 * Edits are written in the card's own version. A 3.0 card marks its preferred
 * address with `TYPE=PREF`, which vCard 4.0 removed in favour of a numeric
 * `PREF` parameter (RFC 6350 §5.3), so writing one form into a card of the
 * other version produces something its server or its other clients may refuse
 * to read.
 */
import {
  escapeText,
  foldLine,
  parseContentLine,
  splitEscaped,
  unescapeText,
  unfoldLines,
} from "@/services/dav/contentLine";
import type { ContactEdits, ContactEmail, ContactPhone } from "./types";
import { formatRev, paramType } from "./vcardHelper";

/** Apply edits to a card, returning the patched card. */
export function editCard(vcardData: string, edits: ContactEdits): string {
  const lines = unfoldLines(vcardData);
  const version = versionOf(lines);

  if (edits.displayName !== undefined) {
    setProperty(lines, "FN", `FN:${escapeText(edits.displayName)}`);
  }

  // N is one property holding both names, so a change to either rewrites it
  // from the card's current value rather than from the form alone.
  if (edits.firstName !== undefined || edits.lastName !== undefined) {
    const current = readNameParts(lines);
    const family = edits.lastName !== undefined ? (edits.lastName ?? "") : current.family;
    const given = edits.firstName !== undefined ? (edits.firstName ?? "") : current.given;
    const rest = current.rest;
    setProperty(
      lines,
      "N",
      `N:${escapeText(family)};${escapeText(given)};${rest.map(escapeText).join(";")}`,
    );
  }

  if (edits.organization !== undefined) {
    setOrRemove(
      lines,
      "ORG",
      edits.organization ? `ORG:${escapeText(edits.organization)};` : null,
    );
  }

  if (edits.jobTitle !== undefined) {
    setOrRemove(lines, "TITLE", edits.jobTitle ? `TITLE:${escapeText(edits.jobTitle)}` : null);
  }

  if (edits.note !== undefined) {
    setOrRemove(lines, "NOTE", edits.note ? `NOTE:${escapeText(edits.note)}` : null);
  }

  if (edits.emails !== undefined) {
    replaceAll(lines, "EMAIL", edits.emails.map((e) => emailLine(e, version)));
  }

  if (edits.phones !== undefined) {
    replaceAll(lines, "TEL", edits.phones.map((p) => phoneLine(p)));
  }

  setProperty(lines, "REV", `REV:${formatRev(new Date())}`);
  return serialize(lines);
}

// ---------------------------------------------------------------------------
// Line surgery
// ---------------------------------------------------------------------------

function versionOf(lines: string[]): string {
  const index = indexOfProperty(lines, "VERSION");
  if (index === -1) return "3.0";
  return parseContentLine(lines[index]!)?.value.trim() || "3.0";
}

function nameOf(line: string): string {
  return parseContentLine(line)?.name ?? "";
}

function groupOf(line: string): string | null {
  return parseContentLine(line)?.group ?? null;
}

function indexOfProperty(lines: string[], name: string): number {
  return lines.findIndex((line) => nameOf(line) === name);
}

/** Replace the first occurrence, or insert before END:VCARD. */
function setProperty(lines: string[], name: string, line: string): void {
  const index = indexOfProperty(lines, name);
  if (index !== -1) {
    lines[index] = line;
    return;
  }
  const end = lines.findIndex((l) => nameOf(l) === "END");
  lines.splice(end === -1 ? lines.length : end, 0, line);
}

function setOrRemove(lines: string[], name: string, line: string | null): void {
  if (line === null) {
    removeAll(lines, name);
    return;
  }
  setProperty(lines, name, line);
}

/**
 * Remove every occurrence of a property, and with it any line left dangling.
 *
 * Apple Contacts ties a custom label to its property through a group:
 * `item1.EMAIL:…` alongside `item1.X-ABLabel:_$!<Work>!$_`. Dropping the
 * address but keeping its label leaves a group naming nothing, which some
 * clients render as an empty field.
 */
function removeAll(lines: string[], name: string): void {
  const orphanedGroups = new Set<string>();

  for (let i = lines.length - 1; i >= 0; i--) {
    if (nameOf(lines[i]!) !== name) continue;
    const group = groupOf(lines[i]!);
    if (group) orphanedGroups.add(group);
    lines.splice(i, 1);
  }

  if (orphanedGroups.size === 0) return;

  for (let i = lines.length - 1; i >= 0; i--) {
    const group = groupOf(lines[i]!);
    if (group && orphanedGroups.has(group)) lines.splice(i, 1);
  }
}

/**
 * Swap the whole set of a repeatable property, keeping its place in the card.
 *
 * The new lines go where the old ones were, so an edit does not shuffle the
 * card's order and produce a diff on the server that touches everything.
 */
function replaceAll(lines: string[], name: string, replacements: string[]): void {
  const at = indexOfProperty(lines, name);
  removeAll(lines, name);

  // Removal shifts what follows and may take group siblings with it, so the
  // remembered position is clamped to the end marker rather than trusted.
  const end = lines.findIndex((l) => nameOf(l) === "END");
  const limit = end === -1 ? lines.length : end;
  const insertAt = at === -1 ? limit : Math.min(at, limit);

  lines.splice(insertAt, 0, ...replacements);
}

interface NameParts {
  family: string;
  given: string;
  /** additional names, prefixes, suffixes — untouched by an edit. */
  rest: string[];
}

/**
 * The card's current name components, unescaped.
 *
 * They are read in the same form the edit supplies and written back escaped
 * once. Carrying them as stored text instead would escape them a second time
 * on every save, so a name containing a semicolon would grow a backslash per
 * edit until it no longer read back at all.
 */
function readNameParts(lines: string[]): NameParts {
  const index = indexOfProperty(lines, "N");
  if (index === -1) return { family: "", given: "", rest: ["", "", ""] };

  const parsed = parseContentLine(lines[index]!);
  const parts = splitEscaped(parsed?.value ?? "", ";").map(unescapeText);
  return {
    family: parts[0] ?? "",
    given: parts[1] ?? "",
    rest: [parts[2] ?? "", parts[3] ?? "", parts[4] ?? ""],
  };
}

function emailLine(email: ContactEmail, version: string): string {
  const type = paramType(email.type || "INTERNET") || "INTERNET";
  const address = escapeText(email.address.trim());

  if (version.startsWith("4")) {
    // 4.0 states rank separately from kind; 1 is the strongest preference.
    const pref = email.isPrimary ? ";PREF=1" : "";
    return `EMAIL;TYPE=${type}${pref}:${address}`;
  }

  return `EMAIL;TYPE=${email.isPrimary ? `${type},PREF` : type}:${address}`;
}

function phoneLine(phone: ContactPhone): string {
  const type = paramType(phone.type || "VOICE") || "VOICE";
  return `TEL;TYPE=${type}:${escapeText(phone.number.trim())}`;
}

function serialize(lines: string[]): string {
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
