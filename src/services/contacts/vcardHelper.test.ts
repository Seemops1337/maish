import {
  formatRev,
  generateVCard,
  parseVCard,
  parseVCards,
  readEmails,
  readPhoto,
  readVersion,
} from "./vcardHelper";

const APPLE_CARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "UID:8f1c-anna",
  "N:Mustermann;Anna-Lena;;Dr.;",
  "FN:Dr. Anna-Lena Mustermann",
  "ORG:Beispiel GmbH;Vertrieb",
  "TITLE:Leiterin",
  "item1.EMAIL;type=INTERNET;type=WORK;type=pref:anna@example.org",
  "item1.X-ABLabel:_$!<Work>!$_",
  "EMAIL;type=INTERNET;type=HOME:anna.privat@example.net",
  "TEL;type=CELL;type=VOICE:+43 664 1234567",
  "NOTE:Kennengelernt auf der Messe",
  "REV:20260101T120000Z",
  "END:VCARD",
].join("\r\n");

describe("parseVCards", () => {
  it("reads a single card", () => {
    const cards = parseVCards(APPLE_CARD);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.props.length).toBeGreaterThan(5);
  });

  it("keeps concatenated cards apart", () => {
    const two = `${APPLE_CARD}\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:Bert\r\nEND:VCARD`;
    const cards = parseVCards(two);
    expect(cards).toHaveLength(2);
    expect(cards[1]!.props.find((p) => p.name === "FN")?.value).toBe("Bert");
  });

  it("still returns a card whose END marker is missing", () => {
    const cards = parseVCards("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Bert");
    expect(cards).toHaveLength(1);
  });

  it("defaults the version to 3.0 when the card states none", () => {
    expect(readVersion({ props: [] })).toBe("3.0");
  });
});

describe("parseVCard", () => {
  it("reads identity, organisation and note", () => {
    const contact = parseVCard(APPLE_CARD, "https://dav.example.org/books/anna.vcf");
    expect(contact.remoteContactId).toBe("https://dav.example.org/books/anna.vcf");
    expect(contact.uid).toBe("8f1c-anna");
    expect(contact.displayName).toBe("Dr. Anna-Lena Mustermann");
    expect(contact.firstName).toBe("Anna-Lena");
    expect(contact.lastName).toBe("Mustermann");
    expect(contact.organization).toBe("Beispiel GmbH");
    expect(contact.jobTitle).toBe("Leiterin");
    expect(contact.note).toBe("Kennengelernt auf der Messe");
  });

  it("reads every address and marks the preferred one", () => {
    const contact = parseVCard(APPLE_CARD, "u");
    expect(contact.emails).toEqual([
      { address: "anna@example.org", type: "WORK", isPrimary: true },
      { address: "anna.privat@example.net", type: "HOME", isPrimary: false },
    ]);
  });

  it("treats the first address as primary when the card marks none", () => {
    const card = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:B\r\nEMAIL:a@x.org\r\nEMAIL:b@x.org\r\nEND:VCARD";
    const contact = parseVCard(card, "u");
    expect(contact.emails.map((e) => e.isPrimary)).toEqual([true, false]);
  });

  it("reads the numeric PREF parameter of a 4.0 card", () => {
    const card = [
      "BEGIN:VCARD", "VERSION:4.0", "FN:Bert",
      "EMAIL;TYPE=HOME:privat@example.org",
      "EMAIL;TYPE=WORK;PREF=1:buero@example.org",
      "END:VCARD",
    ].join("\r\n");
    const emails = parseVCard(card, "u").emails;
    expect(emails.find((e) => e.isPrimary)?.address).toBe("buero@example.org");
  });

  it("strips a mailto prefix a 2.1 writer left on the value", () => {
    const card = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:B\r\nEMAIL:mailto:b@x.org\r\nEND:VCARD";
    expect(parseVCard(card, "u").emails[0]!.address).toBe("b@x.org");
  });

  it("reads phone numbers with their type", () => {
    const contact = parseVCard(APPLE_CARD, "u");
    expect(contact.phones).toEqual([{ number: "+43 664 1234567", type: "CELL" }]);
  });

  it("unfolds a folded value before reading it", () => {
    // The fold takes one whitespace character with it, so a space that belongs
    // to the text has to sit after the one the fold added.
    const card = [
      "BEGIN:VCARD", "VERSION:3.0", "FN:B",
      "NOTE:Ein sehr langer Hinweis der", "  ueber zwei Zeilen laeuft",
      "END:VCARD",
    ].join("\r\n");
    expect(parseVCard(card, "u").note).toBe("Ein sehr langer Hinweis der ueber zwei Zeilen laeuft");
  });

  it("joins a fold that fell inside a word without inserting a space", () => {
    const card = [
      "BEGIN:VCARD", "VERSION:3.0", "FN:B",
      "NOTE:Donaudampfschifffahrts", " gesellschaft",
      "END:VCARD",
    ].join("\r\n");
    expect(parseVCard(card, "u").note).toBe("Donaudampfschifffahrtsgesellschaft");
  });

  it("unescapes a value that carries separators", () => {
    const card = [
      "BEGIN:VCARD", "VERSION:3.0", "FN:B",
      "NOTE:Erst dies\\, dann das\\; und so weiter\\nZeile zwei",
      "END:VCARD",
    ].join("\r\n");
    expect(parseVCard(card, "u").note).toBe("Erst dies, dann das; und so weiter\nZeile zwei");
  });

  it("does not split a structured value at an escaped separator", () => {
    const card = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:von Trapp\\; Familie;Maria;;;\r\nFN:M\r\nEND:VCARD";
    const contact = parseVCard(card, "u");
    expect(contact.lastName).toBe("von Trapp; Familie");
    expect(contact.firstName).toBe("Maria");
  });

  it("reads the postal address components", () => {
    const card = [
      "BEGIN:VCARD", "VERSION:3.0", "FN:B",
      "ADR;TYPE=WORK:;;Hauptstrasse 1;Wien;;1010;Austria",
      "END:VCARD",
    ].join("\r\n");
    expect(parseVCard(card, "u").addresses[0]).toEqual({
      street: "Hauptstrasse 1",
      city: "Wien",
      region: null,
      postalCode: "1010",
      country: "Austria",
      type: "WORK",
    });
  });

  it("falls back to the name parts when the card has no FN", () => {
    const card = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Bauer;Franz;;;\r\nEND:VCARD";
    expect(parseVCard(card, "u").displayName).toBe("Franz Bauer");
  });

  it("falls back to the first address when the card has no name at all", () => {
    const card = "BEGIN:VCARD\r\nVERSION:3.0\r\nEMAIL:only@example.org\r\nEND:VCARD";
    expect(parseVCard(card, "u").displayName).toBe("only@example.org");
  });

  it("keeps the card verbatim so an edit can patch it", () => {
    expect(parseVCard(APPLE_CARD, "u").vcardData).toBe(APPLE_CARD);
  });
});

describe("readEmails", () => {
  it("ignores an address property with an empty value", () => {
    const card = parseVCards("BEGIN:VCARD\r\nEMAIL:\r\nEMAIL:b@x.org\r\nEND:VCARD")[0]!;
    expect(readEmails(card)).toHaveLength(1);
  });
});

describe("readPhoto", () => {
  it("builds a data URI from a 3.0 embedded photo", () => {
    const card = parseVCards(
      "BEGIN:VCARD\r\nPHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQ\r\nEND:VCARD",
    )[0]!;
    expect(readPhoto(card)).toBe("data:image/jpeg;base64,/9j/4AAQ");
  });

  it("takes a 4.0 data URI as it stands", () => {
    const card = parseVCards(
      "BEGIN:VCARD\r\nPHOTO:data:image/png;base64,iVBOR\r\nEND:VCARD",
    )[0]!;
    expect(readPhoto(card)).toBe("data:image/png;base64,iVBOR");
  });

  it("accepts an https URL", () => {
    const card = parseVCards("BEGIN:VCARD\r\nPHOTO:https://x.org/a.png\r\nEND:VCARD")[0]!;
    expect(readPhoto(card)).toBe("https://x.org/a.png");
  });

  it("refuses a value that is neither an image nor a fetchable URL", () => {
    const card = parseVCards("BEGIN:VCARD\r\nPHOTO:javascript:alert(1)\r\nEND:VCARD")[0]!;
    expect(readPhoto(card)).toBeNull();
  });
});

describe("generateVCard", () => {
  it("writes a card that reads back with the same fields", () => {
    const vcard = generateVCard(
      {
        displayName: "Anna Mustermann",
        firstName: "Anna",
        lastName: "Mustermann",
        emails: [
          { address: "anna@example.org", type: "WORK", isPrimary: true },
          { address: "privat@example.net", type: "HOME", isPrimary: false },
        ],
        phones: [{ number: "+43 1 234", type: "WORK" }],
        organization: "Beispiel GmbH",
        jobTitle: "Leiterin",
        note: "Notiz",
      },
      "uid-1",
    );

    const contact = parseVCard(vcard, "u");
    expect(contact.uid).toBe("uid-1");
    expect(contact.displayName).toBe("Anna Mustermann");
    expect(contact.firstName).toBe("Anna");
    expect(contact.lastName).toBe("Mustermann");
    expect(contact.emails).toEqual([
      { address: "anna@example.org", type: "WORK", isPrimary: true },
      { address: "privat@example.net", type: "HOME", isPrimary: false },
    ]);
    expect(contact.phones).toEqual([{ number: "+43 1 234", type: "WORK" }]);
    expect(contact.organization).toBe("Beispiel GmbH");
    expect(contact.jobTitle).toBe("Leiterin");
    expect(contact.note).toBe("Notiz");
  });

  it("opens and closes the card and states its version", () => {
    const vcard = generateVCard({ displayName: "B" }, "uid-2");
    expect(vcard.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(vcard.trimEnd().endsWith("END:VCARD")).toBe(true);
  });

  it("escapes a name that carries a separator", () => {
    const vcard = generateVCard(
      { displayName: "Meier; Co", lastName: "Meier; Co", firstName: "" },
      "uid-3",
    );
    expect(parseVCard(vcard, "u").lastName).toBe("Meier; Co");
  });

  it("skips an empty address rather than writing a bare property", () => {
    const vcard = generateVCard(
      { displayName: "B", emails: [{ address: "  ", type: null, isPrimary: false }] },
      "uid-4",
    );
    expect(vcard).not.toContain("EMAIL");
  });

  it("separates lines with CRLF as the format requires", () => {
    expect(generateVCard({ displayName: "B" }, "uid-5")).toContain("\r\n");
  });
});

describe("formatRev", () => {
  it("writes a UTC timestamp", () => {
    expect(formatRev(new Date(Date.UTC(2026, 7, 16, 9, 5, 3)))).toBe("20260816T090503Z");
  });
});
