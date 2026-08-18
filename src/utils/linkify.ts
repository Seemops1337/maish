import { escapeHtml } from "@/utils/sanitize";

/**
 * Turns URLs in a plain-text email body into anchors.
 *
 * Escaping and linkification happen in a single pass, and the order matters in
 * both directions: escaping the finished markup would show the anchors as
 * text, while matching against already-escaped text would let a body that
 * contains `&`, `<` or `"` steer the match and end up as markup. So every run
 * of body text is escaped on its way into the output, and the anchors are the
 * only thing ever written unescaped.
 *
 * Only http(s), mailto and bare `www.` hosts and e-mail addresses are matched,
 * which keeps the generated hrefs inside the schemes the app is willing to
 * hand to the system opener (see `EmailRenderer`).
 */

// Three shapes, tried in this order at every position: an explicit scheme, a
// bare `www.` host, a bare e-mail address. `<` and `>` end a match so the
// `<https://example.com>` form common in mail leaves its brackets behind, and
// `"` ends one so a match can never carry a quote into the href attribute.
const LINK_PATTERN =
  /\b(?:https?:\/\/|mailto:)[^\s<>"`]+|\bwww\.[^\s<>"`]+|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gi;

// Punctuation that ends a sentence rather than a URL.
const TRAILING_PUNCTUATION = ".,;:!?'\"`´”’»";

const BRACKET_PAIRS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function countChar(text: string, char: string): number {
  let count = 0;
  for (const current of text) {
    if (current === char) count += 1;
  }
  return count;
}

/**
 * Drop trailing characters that belong to the surrounding prose. A closing
 * bracket is only dropped when the URL has no matching opener, so
 * `https://en.wikipedia.org/wiki/Foo_(bar)` keeps its parenthesis while
 * `(see https://example.com)` does not.
 */
function trimTrailingPunctuation(url: string): string {
  let end = url.length;

  while (end > 0) {
    const char = url[end - 1]!;

    if (TRAILING_PUNCTUATION.includes(char)) {
      end -= 1;
      continue;
    }

    const opener = BRACKET_PAIRS[char];
    if (opener !== undefined) {
      const head = url.slice(0, end);
      if (countChar(head, opener) < countChar(head, char)) {
        end -= 1;
        continue;
      }
    }

    break;
  }

  return url.slice(0, end);
}

/**
 * The href for a matched candidate, or null when trimming left something that
 * is not worth linking.
 */
function toHref(candidate: string): string | null {
  const lower = candidate.toLowerCase();

  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    const host = candidate.slice(lower.startsWith("http://") ? 7 : 8);
    return host.length > 0 ? candidate : null;
  }

  if (lower.startsWith("mailto:")) {
    const address = candidate.slice("mailto:".length);
    return address.length > 0 ? candidate : null;
  }

  if (lower.startsWith("www.")) {
    // A single label behind `www.` is not a host — `www.` at the end of a
    // sentence would otherwise become a link.
    const rest = candidate.slice("www.".length);
    return rest.includes(".") ? `https://${candidate}` : null;
  }

  // Bare e-mail address; the pattern already required a dotted domain.
  return `mailto:${candidate}`;
}

export function linkifyPlainText(text: string): string {
  let result = "";
  let consumed = 0;

  LINK_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    const candidate = trimTrailingPunctuation(match[0]);
    const href = candidate.length > 0 ? toHref(candidate) : null;
    if (href === null) continue;

    result += escapeHtml(text.slice(consumed, match.index));
    result += `<a href="${escapeHtml(href)}">${escapeHtml(candidate)}</a>`;

    // Whatever trimming gave back is prose again and is picked up by the next
    // slice of plain text.
    consumed = match.index + candidate.length;
  }

  result += escapeHtml(text.slice(consumed));

  return result;
}
