/**
 * Turn what a user typed into an FTS5 MATCH expression.
 *
 * The right-hand side of MATCH is a query language, not a search string:
 * "@", "-", "(", "'" and the bare words AND/OR/NOT/NEAR are syntax there, so
 * an ordinary query such as an email address raises a syntax error rather than
 * returning no rows. Wrapping every term in double quotes turns it into an
 * FTS5 phrase, where those characters are literal (RFC-free territory, but see
 * the SQLite FTS5 docs on "FTS5 Strings"). A double quote inside a phrase is
 * written twice, which is the only escape the phrase syntax has.
 *
 * Terms are quoted one by one rather than the whole query at once: FTS5 places
 * an implicit AND between adjacent phrases, so "hello" "world" keeps the
 * meaning an unquoted `hello world` already had, whereas the single phrase
 * "hello world" would quietly demand the two words be adjacent.
 */
export function toFtsMatchExpression(query: string): string {
  return query
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(" ");
}
