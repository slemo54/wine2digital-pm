import assert from "node:assert/strict";
import test from "node:test";
import {
  ClockifyEntryError,
  canonicalizeClockifyActor,
  findClockifyEffectivePeriodLockIds,
  parseClockifySplitAt,
  runClockifyActorTransaction,
  runClockifySerializableTransaction,
} from "./clockify-v2-entries";

test("entry lock actors use the canonical department shared with period-lock writers", async () => {
  const actor = await canonicalizeClockifyActor(
    { userId: "u1", role: "manager", department: " grafica " },
    async (department) => String(department).trim().toLocaleUpperCase("it-IT"),
  );
  assert.equal(actor.department, "GRAFICA");
});

test("effective period locks use one parameterized batch query for all page entries", async () => {
  const queries: unknown[] = [];
  const db = { $queryRaw: async (query: unknown) => { queries.push(query); return [{ id: "e1" }]; } };
  const ids = await findClockifyEffectivePeriodLockIds(db, [
    { id: "e1", userId: "u1", workDate: new Date("2026-07-22T22:00:00.000Z"), user: { department: " grafica " } },
    { id: "e2", userId: "u2", workDate: new Date("2026-07-22T22:00:00.000Z"), user: { department: "GRAFICA" } },
  ]);
  assert.deepEqual([...ids], ["e1"]);
  assert.equal(queries.length, 1);
});

test("entry mutations use a Serializable transaction, advisory protocol lock, and retry serialization conflicts", async () => {
  const options: any[] = [], locks: any[] = [];
  let attempts = 0;
  const db = {
    $transaction: async (work: any, option: any) => {
      options.push(option); attempts += 1;
      if (attempts === 1) { const error: any = new Error("serialization failure"); error.code = "P2034"; throw error; }
      return work(db);
    },
    $queryRawUnsafe: async (...args: any[]) => {
      locks.push(args);
      if (!String(args[0]).includes("::text")) {
        const error: any = new Error("Failed to deserialize column of type 'void'");
        error.code = "P2010";
        throw error;
      }
      return [{ lockResult: "" }];
    },
  };
  const value = await runClockifySerializableTransaction(db, async () => "done");
  assert.equal(value, "done");
  assert.equal(options.length, 2);
  assert.equal(options[0].isolationLevel, "Serializable");
  assert.equal(locks.length, 1);
});

test("entry actors are canonicalized before the transaction starts and mutations have a bounded production timeout", async () => {
  const events: string[] = [];
  const options: any[] = [];
  const db = {
    $transaction: async (work: any, option: any) => {
      events.push("transaction");
      options.push(option);
      return work(db);
    },
  };
  const result = await runClockifyActorTransaction(
    db,
    { userId: "u1", role: "member", department: " grafica " },
    async (_tx, actor) => actor.department,
    async () => {
      events.push("normalize");
      return "Grafica";
    },
  );
  assert.equal(result, "Grafica");
  assert.deepEqual(events, ["normalize", "transaction"]);
  assert.equal(options[0].timeout, 15_000);
  assert.equal(options[0].maxWait, 10_000);
});

test("entry mutations fail closed before opening a transaction when an assigned department cannot be canonicalized", async () => {
  let transactions = 0;
  const db = {
    $transaction: async () => {
      transactions += 1;
    },
  };
  await assert.rejects(
    () => runClockifyActorTransaction(
      db,
      { userId: "u1", role: "member", department: "Commerciale" },
      async () => "unreachable",
      async () => null,
    ),
    (error: unknown) => error instanceof ClockifyEntryError && error.status === 409,
  );
  assert.equal(transactions, 0);
});

test("canonical lock fallback reuses the supplied department without normalizing inside the transaction", async () => {
  let where: any;
  const db = {
    clockifyLockPeriod: {
      findFirst: async (value: any) => {
        where = value.where;
        return null;
      },
    },
  };
  await findClockifyEffectivePeriodLockIds(
    db,
    [{ id: "e1", userId: "u1", workDate: new Date("2026-07-21T22:00:00.000Z"), user: { department: "Commerciale" } }],
    { departmentsCanonical: true },
  );
  assert.equal(where.OR[1].department.equals, "Commerciale");
});

test("split points are explicit Europe/Rome wall time and reject gaps or seconds", () => {
  assert.equal(parseClockifySplitAt({ splitDate: "2026-10-25", splitTime: "02:30" }).toISOString(), "2026-10-25T00:30:00.000Z");
  assert.throws(() => parseClockifySplitAt({ splitDate: "2026-03-29", splitTime: "02:30" }), /does not exist/i);
  assert.throws(() => parseClockifySplitAt({ splitDate: "2026-07-22", splitTime: "09:30:01" }), (error: unknown) => error instanceof ClockifyEntryError && error.status === 400);
});
