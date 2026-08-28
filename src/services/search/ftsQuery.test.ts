import { describe, it, expect } from "vitest";
import { toFtsMatchExpression } from "./ftsQuery";

/**
 * What a user types is free text, but FTS5 reads the right-hand side of MATCH
 * as a query expression: "@", "-", "(", "'" and the bare words AND/OR/NOT/NEAR
 * are all syntax there. An unescaped address such as simon@hochreiner.xyz
 * raises "fts5: syntax error near \"@\"", which SearchBar swallows and turns
 * into an empty thread-id filter — and an empty filter means "no search
 * active" to EmailList, so the user is shown the whole mailbox and reads it as
 * the result. Every term is therefore quoted as a phrase.
 *
 * The expectations below were checked against sqlite3 3.51 with a
 * tokenize='trigram' table, which is the tokenizer messages_fts uses.
 */
describe("toFtsMatchExpression", () => {
  it("quotes an email address so FTS5 does not read @ as an operator", () => {
    expect(toFtsMatchExpression("simon@hochreiner.xyz")).toBe('"simon@hochreiner.xyz"');
  });

  it("quotes each term separately so multiple words stay an AND", () => {
    // FTS5 puts an implicit AND between two phrases, which is what an
    // unquoted "hello world" already meant. Quoting the whole query as one
    // phrase would silently narrow that to an adjacency match.
    expect(toFtsMatchExpression("hello world")).toBe('"hello" "world"');
  });

  it("doubles an embedded double quote rather than ending the phrase", () => {
    expect(toFtsMatchExpression('say "hi"')).toBe('"say" """hi"""');
  });

  it("neutralises the bare boolean operators", () => {
    expect(toFtsMatchExpression("AND")).toBe('"AND"');
    expect(toFtsMatchExpression("a NEAR b")).toBe('"a" "NEAR" "b"');
  });

  it("neutralises punctuation that FTS5 treats as syntax", () => {
    expect(toFtsMatchExpression("foo-bar")).toBe('"foo-bar"');
    expect(toFtsMatchExpression("a(b")).toBe('"a(b"');
    expect(toFtsMatchExpression("o'brien")).toBe(`"o'brien"`);
    expect(toFtsMatchExpression("*")).toBe('"*"');
  });

  it("collapses surrounding and repeated whitespace", () => {
    expect(toFtsMatchExpression("  hello   world  ")).toBe('"hello" "world"');
  });

  it("returns an empty string for a query with no terms", () => {
    expect(toFtsMatchExpression("   ")).toBe("");
    expect(toFtsMatchExpression("")).toBe("");
  });
});
