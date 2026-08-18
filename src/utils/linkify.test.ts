import { linkifyPlainText } from "./linkify";

describe("linkifyPlainText", () => {
  it("leaves text without links alone", () => {
    expect(linkifyPlainText("Hello world")).toBe("Hello world");
  });

  it("escapes surrounding text", () => {
    expect(linkifyPlainText('a < b & c > d "quoted"')).toBe(
      "a &lt; b &amp; c &gt; d &quot;quoted&quot;",
    );
  });

  it("returns an empty string for empty input", () => {
    expect(linkifyPlainText("")).toBe("");
  });

  describe("scheme URLs", () => {
    it("links http and https", () => {
      expect(linkifyPlainText("See https://example.com/x now")).toBe(
        'See <a href="https://example.com/x">https://example.com/x</a> now',
      );
      expect(linkifyPlainText("http://example.com")).toBe(
        '<a href="http://example.com">http://example.com</a>',
      );
    });

    it("links several URLs in one body", () => {
      expect(linkifyPlainText("a https://one.example b https://two.example c")).toBe(
        'a <a href="https://one.example">https://one.example</a>'
        + ' b <a href="https://two.example">https://two.example</a> c',
      );
    });

    it("keeps the query string and escapes its ampersands", () => {
      expect(linkifyPlainText("https://example.com/s?a=1&b=2")).toBe(
        '<a href="https://example.com/s?a=1&amp;b=2">https://example.com/s?a=1&amp;b=2</a>',
      );
    });

    it("matches a scheme in any case", () => {
      expect(linkifyPlainText("HTTPS://Example.COM/X")).toBe(
        '<a href="HTTPS://Example.COM/X">HTTPS://Example.COM/X</a>',
      );
    });

    it("does not match a scheme glued to a preceding word", () => {
      expect(linkifyPlainText("xhttps://example.com")).toBe("xhttps://example.com");
    });

    it("ignores a scheme without a host", () => {
      expect(linkifyPlainText("https:// and mailto:")).toBe("https:// and mailto:");
    });
  });

  describe("trailing punctuation", () => {
    it("drops a sentence-final period", () => {
      expect(linkifyPlainText("Go to https://example.com/x.")).toBe(
        'Go to <a href="https://example.com/x">https://example.com/x</a>.',
      );
    });

    it("drops other trailing punctuation", () => {
      for (const mark of [",", ";", ":", "!", "?", '"', "'", "»"]) {
        expect(linkifyPlainText(`https://example.com${mark}`)).toBe(
          `<a href="https://example.com">https://example.com</a>${
            mark === '"' ? "&quot;" : mark
          }`,
        );
      }
    });

    it("drops a run of trailing punctuation", () => {
      expect(linkifyPlainText("Really? https://example.com/x?!")).toBe(
        'Really? <a href="https://example.com/x">https://example.com/x</a>?!',
      );
    });

    it("keeps punctuation that is not at the end", () => {
      expect(linkifyPlainText("https://example.com/a.b,c/ ")).toBe(
        '<a href="https://example.com/a.b,c/">https://example.com/a.b,c/</a> ',
      );
    });
  });

  describe("brackets", () => {
    it("keeps a balanced parenthesis that belongs to the URL", () => {
      const url = "https://en.wikipedia.org/wiki/Foo_(bar)";
      expect(linkifyPlainText(url)).toBe(`<a href="${url}">${url}</a>`);
    });

    it("drops a closing parenthesis the URL never opened", () => {
      expect(linkifyPlainText("(see https://example.com/x)")).toBe(
        '(see <a href="https://example.com/x">https://example.com/x</a>)',
      );
    });

    it("drops only the unmatched closing parenthesis", () => {
      expect(linkifyPlainText("(https://en.wikipedia.org/wiki/Foo_(bar))")).toBe(
        '(<a href="https://en.wikipedia.org/wiki/Foo_(bar)">'
        + "https://en.wikipedia.org/wiki/Foo_(bar)</a>)",
      );
    });

    it("handles square and curly brackets the same way", () => {
      expect(linkifyPlainText("[https://example.com/x]")).toBe(
        '[<a href="https://example.com/x">https://example.com/x</a>]',
      );
      expect(linkifyPlainText("{https://example.com/x}")).toBe(
        '{<a href="https://example.com/x">https://example.com/x</a>}',
      );
    });

    it("leaves angle brackets outside the link", () => {
      expect(linkifyPlainText("<https://example.com/x>")).toBe(
        '&lt;<a href="https://example.com/x">https://example.com/x</a>&gt;',
      );
    });
  });

  describe("mail addresses", () => {
    it("links an explicit mailto URL", () => {
      expect(linkifyPlainText("mailto:a@b.com")).toBe(
        '<a href="mailto:a@b.com">mailto:a@b.com</a>',
      );
    });

    it("links a bare address through mailto", () => {
      expect(linkifyPlainText("Write to first.last@example.com today")).toBe(
        'Write to <a href="mailto:first.last@example.com">first.last@example.com</a> today',
      );
    });

    it("drops a period after an address", () => {
      expect(linkifyPlainText("Ask a@b.com.")).toBe(
        'Ask <a href="mailto:a@b.com">a@b.com</a>.',
      );
    });

    it("does not link an address without a dotted domain", () => {
      expect(linkifyPlainText("root@localhost")).toBe("root@localhost");
    });

    it("does not split an address out of a URL that contains one", () => {
      expect(linkifyPlainText("https://example.com/u/a@b.com")).toBe(
        '<a href="https://example.com/u/a@b.com">https://example.com/u/a@b.com</a>',
      );
    });
  });

  describe("bare www hosts", () => {
    it("links over https", () => {
      expect(linkifyPlainText("Visit www.example.com/x")).toBe(
        'Visit <a href="https://www.example.com/x">www.example.com/x</a>',
      );
    });

    it("does not link a lone www label", () => {
      expect(linkifyPlainText("www.foo and www. bar")).toBe("www.foo and www. bar");
    });

    it("does not match www inside a scheme URL twice", () => {
      expect(linkifyPlainText("https://www.example.com")).toBe(
        '<a href="https://www.example.com">https://www.example.com</a>',
      );
    });
  });

  describe("escaping", () => {
    it("never emits mail content as markup", () => {
      const result = linkifyPlainText('<script>alert(1)</script> https://example.com');
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("cannot break out of the href attribute", () => {
      // The quote ends the match, and what follows is escaped prose — there is
      // no second attribute, only text that reads like one.
      const result = linkifyPlainText('https://example.com/"onclick="x');
      expect(result).not.toContain('"onclick');
      expect(result).toBe(
        '<a href="https://example.com/">https://example.com/</a>&quot;onclick=&quot;x',
      );
    });

    it("escapes an ampersand sequence the body already contains", () => {
      expect(linkifyPlainText("https://example.com/?a=&amp;b=1")).toBe(
        '<a href="https://example.com/?a=&amp;amp;b=1">https://example.com/?a=&amp;amp;b=1</a>',
      );
    });
  });

  it("preserves line breaks between links", () => {
    expect(linkifyPlainText("https://a.example\nhttps://b.example")).toBe(
      '<a href="https://a.example">https://a.example</a>\n'
      + '<a href="https://b.example">https://b.example</a>',
    );
  });
});
