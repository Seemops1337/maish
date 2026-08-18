import { editCard } from "./vcardEdit";
import { parseVCard } from "./vcardHelper";

const STORED = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "UID:8f1c-anna",
  "N:Mustermann;Anna;;;",
  "FN:Anna Mustermann",
  "ORG:Beispiel GmbH;",
  "EMAIL;TYPE=WORK,PREF:anna@example.org",
  "TEL;TYPE=CELL:+43 664 1234567",
  "PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRg",
  "BDAY:1984-03-17",
  "CATEGORIES:Kunden,Messe",
  "X-SOCIALPROFILE;type=mastodon:https://social.example/@anna",
  "REV:20260101T120000Z",
  "END:VCARD",
].join("\r\n");

describe("editCard", () => {
  it("keeps every property the edit does not mention", () => {
    const updated = editCard(STORED, { displayName: "Anna M. Mustermann" });

    expect(updated).toContain("PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRg");
    expect(updated).toContain("BDAY:1984-03-17");
    expect(updated).toContain("CATEGORIES:Kunden,Messe");
    expect(updated).toContain("X-SOCIALPROFILE;type=mastodon:https://social.example/@anna");
    expect(updated).toContain("UID:8f1c-anna");
    expect(updated).toContain("VERSION:3.0");
  });

  it("replaces the display name rather than adding a second one", () => {
    const updated = editCard(STORED, { displayName: "Anna M. Mustermann" });
    expect(updated.match(/^FN:/gm)).toHaveLength(1);
    expect(parseVCard(updated, "u").displayName).toBe("Anna M. Mustermann");
  });

  it("rewrites N from the card when only one half of the name changes", () => {
    const updated = editCard(STORED, { lastName: "Mustermann-Bauer" });
    const contact = parseVCard(updated, "u");
    expect(contact.lastName).toBe("Mustermann-Bauer");
    expect(contact.firstName).toBe("Anna");
  });

  it("keeps the additional name parts a form never showed", () => {
    const stored = STORED.replace("N:Mustermann;Anna;;;", "N:Mustermann;Anna;Maria;Dr.;MBA");
    const updated = editCard(stored, { firstName: "Anna-Lena" });
    expect(updated).toContain("N:Mustermann;Anna-Lena;Maria;Dr.;MBA");
  });

  it("does not escape a name component a second time on each save", () => {
    const stored = STORED.replace("N:Mustermann;Anna;;;", "N:von Trapp\\; Familie;Maria;;;");
    let updated = stored;
    for (let i = 0; i < 3; i++) updated = editCard(updated, { firstName: "Maria" });

    expect(parseVCard(updated, "u").lastName).toBe("von Trapp; Familie");
    expect(updated).toContain("N:von Trapp\\; Familie;Maria;;;");
  });

  it("swaps the whole set of addresses", () => {
    const updated = editCard(STORED, {
      emails: [
        { address: "neu@example.org", type: "WORK", isPrimary: true },
        { address: "zweit@example.net", type: "HOME", isPrimary: false },
      ],
    });

    const contact = parseVCard(updated, "u");
    expect(contact.emails.map((e) => e.address)).toEqual([
      "neu@example.org", "zweit@example.net",
    ]);
    expect(updated).not.toContain("anna@example.org");
  });

  it("writes the preferred address in the card's own version", () => {
    const three = editCard(STORED, {
      emails: [{ address: "a@x.org", type: "WORK", isPrimary: true }],
    });
    expect(three).toContain("EMAIL;TYPE=WORK,PREF:a@x.org");

    const four = editCard(STORED.replace("VERSION:3.0", "VERSION:4.0"), {
      emails: [{ address: "a@x.org", type: "WORK", isPrimary: true }],
    });
    expect(four).toContain("EMAIL;TYPE=WORK;PREF=1:a@x.org");
    expect(four).not.toContain("PREF:");
  });

  it("removes a property when the edit clears it", () => {
    const updated = editCard(STORED, { organization: null });
    expect(updated).not.toContain("ORG:");
    expect(updated).toContain("FN:Anna Mustermann");
  });

  it("adds a property the card did not have", () => {
    const updated = editCard(STORED, { note: "Neue Notiz" });
    expect(parseVCard(updated, "u").note).toBe("Neue Notiz");
    expect(updated).toContain("END:VCARD");
    expect(updated.indexOf("NOTE:")).toBeLessThan(updated.indexOf("END:VCARD"));
  });

  it("clears every address when the edit passes an empty list", () => {
    const updated = editCard(STORED, { emails: [] });
    expect(updated).not.toContain("EMAIL");
    expect(parseVCard(updated, "u").emails).toEqual([]);
  });

  it("takes an orphaned group label with the address it belonged to", () => {
    const grouped = [
      "BEGIN:VCARD", "VERSION:3.0", "FN:Anna",
      "item1.EMAIL;TYPE=INTERNET:anna@example.org",
      "item1.X-ABLabel:_$!<Work>!$_",
      "END:VCARD",
    ].join("\r\n");

    const updated = editCard(grouped, {
      emails: [{ address: "neu@example.org", type: "WORK", isPrimary: true }],
    });
    expect(updated).not.toContain("X-ABLabel");
    expect(updated).toContain("neu@example.org");
  });

  it("leaves a group alone whose property was not touched", () => {
    const grouped = [
      "BEGIN:VCARD", "VERSION:3.0", "FN:Anna",
      "item1.URL:https://example.org",
      "item1.X-ABLabel:Homepage",
      "EMAIL:anna@example.org",
      "END:VCARD",
    ].join("\r\n");

    const updated = editCard(grouped, { emails: [] });
    expect(updated).toContain("item1.URL:https://example.org");
    expect(updated).toContain("item1.X-ABLabel:Homepage");
  });

  it("escapes text that carries separators", () => {
    const updated = editCard(STORED, { note: "Erst dies, dann das; Ende" });
    expect(updated).toContain("NOTE:Erst dies\\, dann das\\; Ende");
    expect(parseVCard(updated, "u").note).toBe("Erst dies, dann das; Ende");
  });

  it("stamps REV so the change is dated", () => {
    const updated = editCard(STORED, { displayName: "Anna M." });
    expect(updated).not.toContain("REV:20260101T120000Z");
    expect(updated).toMatch(/REV:\d{8}T\d{6}Z/);
    expect(updated.match(/^REV:/gm)).toHaveLength(1);
  });

  it("folds a line the edit made too long, and it reads back whole", () => {
    const note = "z".repeat(300);
    const updated = editCard(STORED, { note });
    expect(updated.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(parseVCard(updated, "u").note).toBe(note);
  });

  it("leaves a card untouched by an edit that mentions nothing", () => {
    const contact = parseVCard(editCard(STORED, {}), "u");
    const before = parseVCard(STORED, "u");
    expect(contact.displayName).toBe(before.displayName);
    expect(contact.emails).toEqual(before.emails);
    expect(contact.photoUrl).toBe(before.photoUrl);
  });
});
