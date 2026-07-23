import assert from "node:assert/strict";
import test from "node:test";
import {
  ClockifyEntryError,
  canonicalizeClockifyActor,
  findClockifyEffectivePeriodLockIds,
  parseClockifySplitAt,
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
    $queryRawUnsafe: async (...args: any[]) => { locks.push(args); },
  };
  const value = await runClockifySerializableTransaction(db, async () => "done");
  assert.equal(value, "done");
  assert.equal(options.length, 2);
  assert.equal(options[0].isolationLevel, "Serializable");
  assert.equal(locks.length, 1);
});

test("split points are explicit Europe/Rome wall time and reject gaps or seconds", () => {
  assert.equal(parseClockifySplitAt({ splitDate: "2026-10-25", splitTime: "02:30" }).toISOString(), "2026-10-25T00:30:00.000Z");
  assert.throws(() => parseClockifySplitAt({ splitDate: "2026-03-29", splitTime: "02:30" }), /does not exist/i);
  assert.throws(() => parseClockifySplitAt({ splitDate: "2026-07-22", splitTime: "09:30:01" }), (error: unknown) => error instanceof ClockifyEntryError && error.status === 400);
});
