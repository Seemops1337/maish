import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Database before importing module under test
const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockDb = { execute: mockExecute, select: mockSelect };

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn(() => Promise.resolve(mockDb)),
  },
}));

// Transactions run on the dedicated Rust connection, not the plugin's pool.
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Use dynamic import so mocks are in place
const { withTransaction, getDb } = await import("./connection");

describe("withTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
  });

  it("executes BEGIN, callback, COMMIT in order", async () => {
    const callOrder: string[] = [];
    mockInvoke.mockImplementation(async (cmd: string) => {
      callOrder.push(cmd);
    });

    await withTransaction(async () => {
      callOrder.push("callback");
    });

    expect(callOrder).toEqual(["db_tx_begin", "callback", "db_tx_commit"]);
  });

  it("never runs transaction statements on the pooled connection", async () => {
    // tauri-plugin-sql hands out pooled connections, so BEGIN and COMMIT could
    // land on different ones — the whole reason for the dedicated connection.
    await withTransaction(async () => {});

    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rolls back on callback error", async () => {
    const callOrder: string[] = [];
    mockInvoke.mockImplementation(async (cmd: string) => {
      callOrder.push(cmd);
    });

    await expect(
      withTransaction(async () => {
        throw new Error("callback failed");
      }),
    ).rejects.toThrow("callback failed");

    expect(callOrder).toEqual(["db_tx_begin", "db_tx_rollback"]);
  });

  it("handles ROLLBACK failure gracefully (SQLite auto-rollback)", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "db_tx_rollback") {
        throw new Error("cannot rollback - no transaction is active");
      }
    });

    // Should still throw the original error, not the ROLLBACK error
    await expect(
      withTransaction(async () => {
        throw new Error("original error");
      }),
    ).rejects.toThrow("original error");
  });

  it("serialises concurrent transactions via mutex", async () => {
    const executionLog: string[] = [];

    mockInvoke.mockImplementation(async (cmd: string) => {
      executionLog.push(cmd);
    });

    // Launch two transactions concurrently
    const tx1 = withTransaction(async () => {
      executionLog.push("tx1-work");
      // Simulate async work
      await new Promise((r) => setTimeout(r, 10));
      executionLog.push("tx1-done");
    });

    const tx2 = withTransaction(async () => {
      executionLog.push("tx2-work");
    });

    await Promise.all([tx1, tx2]);

    // tx1 should fully complete (BEGIN, work, done, COMMIT) before tx2 starts
    const tx1BeginIdx = executionLog.indexOf("db_tx_begin");
    const tx1CommitIdx = executionLog.indexOf("db_tx_commit");
    const tx2BeginIdx = executionLog.lastIndexOf("db_tx_begin");

    expect(tx1BeginIdx).toBeLessThan(tx1CommitIdx);
    expect(tx1CommitIdx).toBeLessThan(tx2BeginIdx);
  });

  it("unblocks next transaction even if current one fails", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "db_tx_rollback") {
        // Simulate auto-rollback already happened
        throw new Error("cannot rollback - no transaction is active");
      }
    });

    // First transaction fails
    const tx1 = withTransaction(async () => {
      throw new Error("tx1 failed");
    }).catch(() => {
      /* expected */
    });

    // Second transaction should still run
    let tx2Ran = false;
    const tx2 = withTransaction(async () => {
      tx2Ran = true;
    });

    await Promise.all([tx1, tx2]);

    expect(tx2Ran).toBe(true);
  });
});

describe("getDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
  });

  it("returns the same instance on repeated calls", async () => {
    const db1 = await getDb();
    const db2 = await getDb();
    expect(db1).toBe(db2);
  });

  it("joins the open transaction while one is running", async () => {
    // The ~74 db modules all call getDb(); if they got a pooled connection
    // they would block on the write lock the transaction holds.
    await withTransaction(async () => {
      const db = await getDb();
      await db.execute("INSERT INTO messages (id) VALUES ($1)", ["m-1"]);
      await db.select("SELECT * FROM messages", []);
    });

    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith("db_tx_execute", {
      sql: "INSERT INTO messages (id) VALUES ($1)",
      params: ["m-1"],
    });
    expect(mockInvoke).toHaveBeenCalledWith("db_tx_select", {
      sql: "SELECT * FROM messages",
      params: [],
    });
  });

  it("returns to the pool once the transaction ends", async () => {
    await withTransaction(async () => {}).catch(() => {});

    const db = await getDb();
    await db.execute("SELECT 1", []);

    expect(mockExecute).toHaveBeenCalledWith("SELECT 1", []);
  });

  it("returns to the pool after a failed transaction", async () => {
    await expect(
      withTransaction(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const db = await getDb();
    await db.execute("SELECT 1", []);

    expect(mockExecute).toHaveBeenCalledWith("SELECT 1", []);
  });
});
