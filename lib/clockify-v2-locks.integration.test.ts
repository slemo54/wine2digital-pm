import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { createClockifyEntry, deleteClockifyEntry, duplicateClockifyEntry, splitClockifyEntry, updateClockifyEntry } from "./clockify-v2-entries";
import { createClockifyLockPeriod, unlockClockifyLockPeriod } from "./clockify-v2-locks";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL serializes period writes against every V2 entry mutation", { skip: !testDatabaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  const marker = `clockify-v2-race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const actor = await db.user.create({ data: { email: `${marker}@test.invalid`, role: "admin", department: "Grafica" } });
  const project = await db.clockifyProject.create({ data: { name: marker, client: marker, createdById: actor.id } });
  const admin = { userId: actor.id, role: "admin" as const, department: "Grafica" };
  const input = (date: string, time = "09:00") => ({ projectId: project.id, description: marker, tags: [], billable: false, date, startTime: time, durationMin: 60 });
  try {
    const runRace = async (date: string, mutation: (entryId: string) => Promise<unknown>): Promise<void> => {
      const source = await createClockifyEntry(db, admin, input(date));
      const [period, result] = await Promise.allSettled([
        createClockifyLockPeriod(db, admin, { startDate: date, endDate: date, scopeType: "all" }),
        mutation((source.entry as { id: string }).id),
      ]);
      assert.equal(period.status, "fulfilled");
      if (result.status === "rejected") assert.match(String(result.reason), /locked/i);
      const periodId = (period.value as { id: string }).id;
      await assert.rejects(() => updateClockifyEntry(db, admin, (source.entry as { id: string }).id, input(date, "11:00")), /locked/i);
      await unlockClockifyLockPeriod(db, admin, periodId);
    };
    await runRace("2026-07-10", async () => createClockifyEntry(db, admin, input("2026-07-10", "11:00")));
    await runRace("2026-07-11", async (id) => updateClockifyEntry(db, admin, id, input("2026-07-11", "11:00")));
    await runRace("2026-07-12", async (id) => deleteClockifyEntry(db, admin, id));
    await runRace("2026-07-13", async (id) => duplicateClockifyEntry(db, admin, id, { date: "2026-07-13", startTime: "11:00", durationMin: 60 }));
    await runRace("2026-07-14", async (id) => splitClockifyEntry(db, admin, id, { splitDate: "2026-07-14", splitTime: "09:30" }));
  } finally {
    await db.clockifyEntry.deleteMany({ where: { projectId: project.id } });
    await db.clockifyLockPeriod.deleteMany({ where: { createdById: actor.id } });
    await db.clockifyProject.delete({ where: { id: project.id } });
    await db.user.delete({ where: { id: actor.id } });
    await db.$disconnect();
  }
});
