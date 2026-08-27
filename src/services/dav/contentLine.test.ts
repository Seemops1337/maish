import {
  escapeText,
  foldLine,
  parseContentLine,
  splitEscaped,
  splitUnquoted,
  stripQuotes,
  unescapeText,
  unfoldLines,
} from "./contentLine";

describe("unfoldLines", () => {
  it("joins a CRLF continuation onto the line before it", () => {
    expect(unfoldLines("NOTE:one\r\n two")).toEqual(["NOTE:onetwo"]);
  });

  it("joins a tab continuation", () => {
    expect(unfoldLines("NOTE:one\r\n\ttwo")).toEqual(["NOTE:onetwo"]);
  });

  it("accepts bare LF, as servers that normalise line endings emit it", () => {
    expect(unfoldLines("A:1\nB:2")).toEqual(["A:1", "B:2"]);
  });

  it("drops empty lines", () => {
    expect(unfoldLines("A:1\n\n\nB:2")).toEqual(["A:1", "B:2"]);
  });
});

describe("parseContentLine", () => {
  it("reads name, parameters and value", () => {
    expect(parseContentLine("EMAIL;TYPE=WORK:anna@example.org")).toEqual({
      name: "EMAIL",
      group: null,
      params: { TYPE: "WORK" },
      value: "anna@example.org",
    });
  });

  it("upper-cases the name and the parameter keys but not the value", () => {
    const line = parseContentLine("email;type=Work:Anna@Example.org");
    expect(line?.name).toBe("EMAIL");
    expect(line?.params).toEqual({ TYPE: "Work" });
    expect(line?.value).toBe("Anna@Example.org");
  });

  it("splits off a group prefix", () => {
    const line = parseContentLine("item1.EMAIL:anna@example.org");
    expect(line?.group).toBe("ITEM1");
    expect(line?.name).toBe("EMAIL");
  });

  it("keeps colons that sit inside a quoted parameter out of the split", () => {
    const line = parseContentLine('ATTENDEE;CN="Doe, John";X-URL="http://x/":mailto:j@x');
    expect(line?.name).toBe("ATTENDEE");
    expect(line?.params["CN"]).toBe("Doe, John");
    expect(line?.params["X-URL"]).toBe("http://x/");
    expect(line?.value).toBe("mailto:j@x");
  });

  it("keeps the colons of a URL value together", () => {
    const line = parseContentLine("URL:https://example.org/a:b");
    expect(line?.value).toBe("https://example.org/a:b");
  });

  it("collects a repeated parameter instead of letting the last one win", () => {
    const line = parseContentLine("TEL;TYPE=WORK;TYPE=VOICE:+43 1 234");
    expect(line?.params["TYPE"]).toBe("WORK,VOICE");
  });

  it("reads a vCard 2.1 bare parameter as a type", () => {
    const line = parseContentLine("EMAIL;INTERNET;PREF:anna@example.org");
    expect(line?.params["TYPE"]).toBe("INTERNET,PREF");
  });

  it("returns null for a line without a value separator", () => {
    expect(parseContentLine("BROKEN")).toBeNull();
  });
});

describe("splitUnquoted", () => {
  it("ignores separators inside quotes", () => {
    expect(splitUnquoted('a;"b;c";d', ";")).toEqual(["a", '"b;c"', "d"]);
  });
});

describe("stripQuotes", () => {
  it("removes surrounding quotes only", () => {
    expect(stripQuotes('"Europe/Vienna"')).toBe("Europe/Vienna");
    expect(stripQuotes('say "hi"')).toBe('say "hi"');
  });
});

describe("splitEscaped", () => {
  it("splits a structured value on its separators", () => {
    expect(splitEscaped("Mustermann;Anna-Lena;;Dr.;", ";")).toEqual([
      "Mustermann", "Anna-Lena", "", "Dr.", "",
    ]);
  });

  it("keeps an escaped separator inside its component", () => {
    expect(splitEscaped("von Trapp\\;Maria;Maria", ";")).toEqual([
      "von Trapp\\;Maria", "Maria",
    ]);
  });

  it("does not treat an escaped backslash as escaping the next character", () => {
    expect(splitEscaped("a\\\\;b", ";")).toEqual(["a\\\\", "b"]);
  });
});

describe("escapeText and unescapeText", () => {
  it("round-trips the characters that carry meaning", () => {
    const text = "Line one\nSemi; comma, backslash \\";
    expect(unescapeText(escapeText(text))).toBe(text);
  });

  it("escapes a backslash before the characters it would otherwise escape", () => {
    expect(escapeText("a\\;b")).toBe("a\\\\\\;b");
  });

  it("reads a lower-case \\n as a newline, which vCard writers emit", () => {
    expect(unescapeText("one\\ntwo")).toBe("one\ntwo");
  });

  /**
   * The escapes have to be read in one pass. Replacing "\\n" before "\\\\"
   * lets the rule for a newline consume the second backslash of an escaped
   * pair, so an escaped backslash that happens to be followed by an "n" is
   * read as a line break — a Windows path in a NOTE or DESCRIPTION comes back
   * broken and is written to the server in that state on the next save.
   */
  it("keeps an escaped backslash that is followed by an n", () => {
    expect(unescapeText("C:\\\\new")).toBe("C:\\new");
  });

  it("round-trips a Windows path", () => {
    const text = "C:\\new\\docs";
    expect(unescapeText(escapeText(text))).toBe(text);
  });

  it("round-trips a backslash before every other escaped character", () => {
    for (const text of ["a\\nb", "a\\;b", "a\\,b", "a\\\\b", "trailing\\"]) {
      expect(unescapeText(escapeText(text))).toBe(text);
    }
  });

  it("reads an escaped backslash followed by a comma as two literals", () => {
    // A TYPE list of one value literally containing a backslash, not two values.
    expect(unescapeText("a\\\\,b")).toBe("a\\,b");
  });

  it("reads an upper-case \\N as a newline too", () => {
    expect(unescapeText("one\\Ntwo")).toBe("one\ntwo");
  });
});

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("FN:Anna")).toBe("FN:Anna");
  });

  it("folds a long line with a leading space on each continuation", () => {
    const folded = foldLine("NOTE:" + "x".repeat(200));
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(unfoldLines(folded)).toEqual(["NOTE:" + "x".repeat(200)]);
  });

  it("counts octets, so a multi-byte character is never cut in half", () => {
    const folded = foldLine("NOTE:" + "ü".repeat(100));
    const encoder = new TextEncoder();
    for (const line of folded.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(unfoldLines(folded)).toEqual(["NOTE:" + "ü".repeat(100)]);
  });
});
