import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

let db: Database | null = null;

/**
 * The subset of the plugin's Database surface this codebase actually uses.
 * Kept structural so the transaction connection can stand in for it.
 */
type DbLike = Pick<Database, "execute" | "select">;

/**
 * Routes statements to the dedicated Rust-side connection (see
 * `src-tauri/src/db_tx.rs`). Set for the duration of a `withTransaction` call
 * so that db helpers calling `getDb()` join the open transaction instead of
 * grabbing a pooled connection that would block on its write lock.
 */
let activeTx: DbLike | null = null;

const txConnection: DbLike = {
  async execute(query: string, bindValues?: unknown[]) {
    const rowsAffected = await invoke<number>("db_tx_execute", {
      sql: query,
      params: bindValues ?? [],
    });
    // The Rust side does not report it and nothing in this codebase reads it.
    return { rowsAffected, lastInsertId: 0 };
  },
  async select<T>(query: string, bindValues?: unknown[]) {
    return (await invoke("db_tx_select", {
      sql: query,
      params: bindValues ?? [],
    })) as T;
  },
};

export async function getDb(): Promise<Database> {
  // Inside a transaction every read and write must use the same connection.
  if (activeTx) return activeTx as Database;

  if (!db) {
    db = await Database.load("sqlite:velo.db");
  }
  return db;
}

/**
 * Build a dynamic SQL UPDATE statement from a set of field updates.
 * Returns null if no fields to update.
 */
export function buildDynamicUpdate(
  table: string,
  idColumn: string,
  id: unknown,
  fields: [string, unknown][],
): { sql: string; params: unknown[] } | null {
  if (fields.length === 0) return null;

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [column, value] of fields) {
    sets.push(`${column} = $${idx++}`);
    params.push(value);
  }

  params.push(id);
  return {
    sql: `UPDATE ${table} SET ${sets.join(", ")} WHERE ${idColumn} = $${idx}`,
    params,
  };
}

/**
 * Simple async mutex to prevent concurrent SQLite transactions.
 * SQLite only supports one writer at a time; overlapping BEGIN/COMMIT/ROLLBACK
 * on the same connection causes "cannot start a transaction within a transaction"
 * or "database is locked" errors.
 */
let txQueue: Promise<void> = Promise.resolve();

export async function withTransaction(fn: (db: Database) => Promise<void>): Promise<void> {
  // Queue this transaction behind any currently-running one.
  // This serialises all transactions without blocking non-transactional reads.
  const prev = txQueue;
  let resolve!: () => void;
  txQueue = new Promise<void>((r) => {
    resolve = r;
  });

  try {
    await prev; // wait for previous transaction to finish
  } catch {
    // previous transaction errored — that's fine, we can still proceed
  }

  // Run on the dedicated Rust connection rather than the plugin's pool.
  // tauri-plugin-sql calls Pool::connect(), so BEGIN, the statements and
  // COMMIT would otherwise land on different connections: the one holding
  // BEGIN keeps the write lock open while the others block on it (issue #240).
  try {
    await invoke("db_tx_begin");
    activeTx = txConnection;
    try {
      await fn(txConnection as Database);
      await invoke("db_tx_commit");
    } catch (err) {
      try {
        await invoke("db_tx_rollback");
      } catch {
        // Already unwound by SQLite — nothing to undo.
      }
      throw err;
    } finally {
      activeTx = null;
    }
  } finally {
    resolve(); // always unblock the next queued transaction
  }
}

/**
 * Execute a SELECT query and return the first result or null.
 */
export async function selectFirstBy<T>(
  query: string,
  params: unknown[] = [],
): Promise<T | null> {
  const db = await getDb();
  const rows = await db.select<T[]>(query, params);
  return rows[0] ?? null;
}

/**
 * Execute a COUNT(*) query and return whether any rows exist.
 */
export async function existsBy(
  query: string,
  params: unknown[] = [],
): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(query, params);
  return (rows[0]?.count ?? 0) > 0;
}

/**
 * Convert a boolean to SQLite integer (0 or 1).
 */
export function boolToInt(value: boolean | undefined | null): number {
  return value ? 1 : 0;
}
