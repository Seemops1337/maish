/**
 * Reading and writing vCards (RFC 6350 for 4.0, RFC 2426 for 3.0).
 *
 * The line format is shared with iCalendar and lives in
 * `@/services/dav/contentLine`; what is specific here is the property set and
 * the two version dialects a CardDAV server hands out side by side. A card
 * written by Apple Contacts is 3.0 and marks the preferred address with
 * `TYPE=PREF`; one written by a Nextcloud client is 4.0 and uses `PREF=1`.
 * Both have to be read, so neither version may be assumed.
 */
import {
  escapeText,
  foldLine,
  parseContentLine,
  splitEscaped,
  unescapeText,
  unfoldLines,
  type ContentLine,
} from "@/services/dav/contentLine";
import type {
  ContactAddress,
  ContactCardData,
  ContactEmail,
  ContactPhone,
  CreateContactInput,
} from "./types";

export interface VCardComponent {
  props: ContentLine[];
}

/**
 * Split a stream into its cards.
 *
 * A CardDAV object holds one card, but an exported file may hold many, and a
 * server that answers a multiget with several cards concatenated is within its
 * rights. Reading properties without tracking BEGIN/END would merge them all
 * into one contact.
 */
export function parseVCards(data: string): VCardComponent[] {
  const cards: VCardComponent[] = [];
  let current: VCardComponent | null = null;

  for (const line of unfoldLines(data)) {
    const parsed = parseContentLine(line);
    if (!parsed) continue;

    if (parsed.name === "BEGIN" && parsed.value.toUpperCase() === "VCARD") {
      current = { props: [] };
      continue;
    }
    if (parsed.name === "END" && parsed.value.toUpperCase() === "VCARD") {
      if (current) cards.push(current);
      current = null;
      continue;
    }
    if (current) current.props.push(parsed);
  }

  // A stream that never closed its card still describes one.
  if (current && current.props.length > 0) cards.push(current);
  return cards;
}

/** The version the card states, defaulting to 3.0 as RFC 2426 readers do. */
export function readVersion(card: VCardComponent): string {
  return card.props.find((p) => p.name === "VERSION")?.value.trim() || "3.0";
}

function first(card: VCardComponent, name: string): ContentLine | undefined {
  return card.props.find((p) => p.name === name);
}

function all(card: VCardComponent, name: string): ContentLine[] {
  return card.props.filter((p) => p.name === name);
}

function textValue(prop: ContentLine | undefined): string | null {
  if (!prop) return null;
  const text = unescapeText(prop.value).trim();
  return text.length > 0 ? text : null;
}

/**
 * Whether a property is the card's preferred one of its kind.
 *
 * 4.0 states it as a numeric PREF parameter where 1 is the strongest; 3.0 puts
 * PREF among the TYPE values.
 */
function isPreferred(prop: ContentLine): boolean {
  const pref = prop.params["PREF"];
  if (pref !== undefined) return pref.trim() === "1" || pref.trim() === "";
  return readTypes(prop).includes("PREF");
}

/** TYPE values, upper-cased. Both `TYPE=WORK,VOICE` and repeats land here. */
function readTypes(prop: ContentLine): string[] {
  const raw = prop.params["TYPE"];
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
}

/** The TYPE a reader would show, dropping the ones that only mark rank. */
function displayType(prop: ContentLine): string | null {
  const types = readTypes(prop).filter(
    (t) => t !== "PREF" && t !== "INTERNET" && t !== "VOICE" && t !== "OTHER",
  );
  return types[0] ?? null;
}

export function readEmails(card: VCardComponent): ContactEmail[] {
  const props = all(card, "EMAIL").filter((p) => p.value.trim().length > 0);
  const anyPreferred = props.some(isPreferred);

  return props.map((prop, index) => ({
    // Some 3.0 writers still prefix the value, as vCard 2.1 allowed.
    address: unescapeText(prop.value).trim().replace(/^mailto:/i, ""),
    type: displayType(prop),
    // With nothing marked preferred, the first address is the one a card is
    // filed under — which is also how the mail composer picks one.
    isPrimary: anyPreferred ? isPreferred(prop) : index === 0,
  }));
}

export function readPhones(card: VCardComponent): ContactPhone[] {
  return all(card, "TEL")
    .filter((p) => p.value.trim().length > 0)
    .map((prop) => ({
      number: unescapeText(prop.value).trim().replace(/^tel:/i, ""),
      type: displayType(prop),
    }));
}

export function readAddresses(card: VCardComponent): ContactAddress[] {
  return all(card, "ADR").map((prop) => {
    // ADR is post office box; extended; street; locality; region; code; country
    const parts = splitEscaped(prop.value, ";").map((p) => unescapeText(p).trim());
    const at = (i: number) => (parts[i] && parts[i]!.length > 0 ? parts[i]! : null);
    return {
      street: at(2),
      city: at(3),
      region: at(4),
      postalCode: at(5),
      country: at(6),
      type: displayType(prop),
    };
  });
}

/**
 * The photo as something an `<img>` can show.
 *
 * 3.0 embeds the bytes as base64 with the media type in a parameter; 4.0 puts
 * a complete data: URI or an https URL in the value. Only http(s) and data are
 * accepted — a card is remote input, and a `javascript:` value would otherwise
 * reach an image source.
 */
export function readPhoto(card: VCardComponent): string | null {
  const prop = first(card, "PHOTO");
  if (!prop) return null;

  const value = prop.value.trim();
  if (!value) return null;

  const encoding = (prop.params["ENCODING"] ?? "").toUpperCase();
  if (encoding === "B" || encoding === "BASE64") {
    const mediaType = (prop.params["TYPE"] ?? "JPEG").split(",")[0]!.trim().toLowerCase();
    const mime = mediaType.startsWith("image/") ? mediaType : `image/${mediaType}`;
    return `data:${mime};base64,${value.replace(/\s+/g, "")}`;
  }

  if (/^data:image\//i.test(value) || /^https?:\/\//i.test(value)) return value;
  return null;
}

export interface VCardName {
  firstName: string | null;
  lastName: string | null;
}

export function readName(card: VCardComponent): VCardName {
  const prop = first(card, "N");
  if (!prop) return { firstName: null, lastName: null };

  // N is family;given;additional;prefixes;suffixes
  const parts = splitEscaped(prop.value, ";").map((p) => unescapeText(p).trim());
  const at = (i: number) => (parts[i] && parts[i]!.length > 0 ? parts[i]! : null);
  return { lastName: at(0), firstName: at(1) };
}

/** ORG is organisation;unit;unit… — only the organisation itself is shown. */
export function readOrganization(card: VCardComponent): string | null {
  const prop = first(card, "ORG");
  if (!prop) return null;
  const parts = splitEscaped(prop.value, ";").map((p) => unescapeText(p).trim());
  return parts[0] && parts[0].length > 0 ? parts[0] : null;
}

/**
 * Read one card into the shape the rest of the app works with.
 *
 * `href` is the object's URL on the server: the card itself does not carry it,
 * and every later write addresses the object by URL rather than by UID.
 */
export function parseVCard(vcardData: string, href: string): ContactCardData {
  const card = parseVCards(vcardData)[0] ?? { props: [] };
  const name = readName(card);
  const emails = readEmails(card);

  return {
    remoteContactId: href,
    uid: textValue(first(card, "UID")),
    etag: null,
    // A card without FN is malformed but happens; the name parts still read.
    displayName: textValue(first(card, "FN")) ?? joinName(name) ?? emails[0]?.address ?? null,
    firstName: name.firstName,
    lastName: name.lastName,
    emails,
    phones: readPhones(card),
    addresses: readAddresses(card),
    organization: readOrganization(card),
    jobTitle: textValue(first(card, "TITLE")),
    note: textValue(first(card, "NOTE")),
    photoUrl: readPhoto(card),
    vcardData,
  };
}

function joinName(name: VCardName): string | null {
  const joined = [name.firstName, name.lastName].filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Build a new card.
 *
 * Written as 3.0 rather than 4.0: it is what iCloud, Google and Nextcloud all
 * accept, whereas 4.0 is still refused outright by some servers. A card read
 * back later is patched in its own version, so this choice only governs cards
 * this app creates.
 */
export function generateVCard(input: CreateContactInput, uid: string): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0", `UID:${escapeText(uid)}`];

  const last = input.lastName ?? "";
  const firstName = input.firstName ?? "";
  lines.push(`N:${escapeText(last)};${escapeText(firstName)};;;`);
  lines.push(`FN:${escapeText(input.displayName)}`);

  for (const email of input.emails ?? []) {
    if (!email.address.trim()) continue;
    lines.push(`EMAIL;TYPE=${emailTypeParam(email)}:${escapeText(email.address.trim())}`);
  }

  for (const phone of input.phones ?? []) {
    if (!phone.number.trim()) continue;
    const type = (phone.type ?? "VOICE").toUpperCase();
    lines.push(`TEL;TYPE=${escapeText(type)}:${escapeText(phone.number.trim())}`);
  }

  if (input.organization) lines.push(`ORG:${escapeText(input.organization)};`);
  if (input.jobTitle) lines.push(`TITLE:${escapeText(input.jobTitle)}`);
  if (input.note) lines.push(`NOTE:${escapeText(input.note)}`);

  lines.push(`REV:${formatRev(new Date())}`);
  lines.push("END:VCARD");

  return formatVCard(lines);
}

/**
 * A TYPE value, reduced to characters a parameter may carry unquoted.
 *
 * Parameter values follow different rules from text values (RFC 6350 §3.3):
 * the comma between two types is structure, not content, so the backslash
 * escaping a NOTE needs would corrupt it into a single type literally called
 * `WORK\,PREF`. Anything outside the safe set is dropped rather than quoted,
 * because a type only ever names a kind.
 */
export function paramType(type: string): string {
  return type.toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

/**
 * The TYPE parameter for an address. 3.0 states preference among the types,
 * so a preferred work address is `TYPE=WORK,PREF` rather than a PREF of its
 * own.
 */
function emailTypeParam(email: ContactEmail): string {
  const type = paramType(email.type || "INTERNET") || "INTERNET";
  return email.isPrimary ? `${type},PREF` : type;
}

/** REV is a UTC timestamp (RFC 6350 §6.7.4). */
export function formatRev(date: Date): string {
  const p = (n: number, width = 2) => String(n).padStart(width, "0");
  return (
    `${p(date.getUTCFullYear(), 4)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}

/** Fold every line and join with CRLF, which RFC 6350 §3.2 requires. */
export function formatVCard(lines: string[]): string {
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
