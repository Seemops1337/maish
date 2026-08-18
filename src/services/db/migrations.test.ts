import { describe, it, expect } from "vitest";
import { MIGRATIONS, splitStatements } from "./migrations";

describe("splitStatements", () => {
  it("splits simple statements", () => {
    const result = splitStatements("CREATE TABLE foo (id INT); CREATE TABLE bar (id INT);");
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("CREATE TABLE foo (id INT)");
    expect(result[1]).toBe("CREATE TABLE bar (id INT)");
  });

  it("keeps trigger body intact", () => {
    const sql = `
      CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, subject) VALUES (new.rowid, new.subject);
      END;
    `;
    const result = splitStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("BEGIN");
    expect(result[0]).toContain("END");
    expect(result[0]).toContain("INSERT INTO messages_fts");
  });

  it("handles multiple triggers", () => {
    const sql = `
      CREATE TABLE foo (id INT);

      CREATE TRIGGER t1 AFTER INSERT ON foo BEGIN
        INSERT INTO bar VALUES (new.id);
      END;

      CREATE TRIGGER t2 AFTER DELETE ON foo BEGIN
        DELETE FROM bar WHERE id = old.id;
      END;
    `;
    const result = splitStatements(sql);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("CREATE TABLE");
    expect(result[1]).toContain("CREATE TRIGGER t1");
    expect(result[2]).toContain("CREATE TRIGGER t2");
  });

  it("handles trigger with multiple statements inside BEGIN...END", () => {
    const sql = `
      CREATE TRIGGER t1 AFTER UPDATE ON messages BEGIN
        INSERT INTO fts(fts, rowid, subject) VALUES ('delete', old.rowid, old.subject);
        INSERT INTO fts(rowid, subject) VALUES (new.rowid, new.subject);
      END;
    `;
    const result = splitStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("BEGIN");
    expect(result[0]).toContain("END");
  });

  it("handles empty input", () => {
    expect(splitStatements("")).toHaveLength(0);
    expect(splitStatements("   ")).toHaveLength(0);
  });

  it("does not match END inside words like BACKEND", () => {
    const sql = "CREATE TABLE backend (id INT); CREATE TABLE foo (id INT);";
    const result = splitStatements(sql);
    expect(result).toHaveLength(2);
  });

  it("ignores a semicolon inside a line comment", () => {
    // Splitting here tears the statement apart mid-sentence and leaves prose
    // where SQL is expected, which fails the whole migration.
    const sql = `
      -- one column; and another
      ALTER TABLE events ADD COLUMN rrule TEXT;
    `;
    const result = splitStatements(sql);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain("ALTER TABLE events ADD COLUMN rrule TEXT");
  });

  it("ignores a semicolon inside a string literal", () => {
    const sql = "INSERT INTO settings VALUES ('a;b'); SELECT 1;";
    const result = splitStatements(sql);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe("INSERT INTO settings VALUES ('a;b')");
  });
});

/**
 * A migration that fails takes the whole startup with it: runMigrations()
 * rethrows, so App.tsx never reaches the point where accounts are loaded and
 * the app comes up empty. The statements therefore have to be checked here
 * rather than on a user's database.
 */
describe("the migrations themselves", () => {
  const SQL_KEYWORDS = /^(ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|PRAGMA|REPLACE|WITH|SELECT)\b/i;

  it("splits every migration into executable statements", () => {
    for (const migration of MIGRATIONS) {
      for (const statement of splitStatements(migration.sql)) {
        const code = statement
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim();
        if (code.length === 0) continue;

        expect(
          code,
          `v${migration.version} (${migration.description}) produced a statement that is not SQL`,
        ).toMatch(SQL_KEYWORDS);
      }
    }
  });

  it("numbers migrations consecutively", () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1),
    );
  });
});
