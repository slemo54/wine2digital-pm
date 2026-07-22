import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { auditClockifyEntries, normalizeClockifyAuditInput } from "./clockify-v2-audit";
import { importClockifyProjects, parseClockifyProjectCsv } from "./clockify-v2-import";

const url = process.env.TEST_DATABASE_URL;
test("PostgreSQL audit excludes deleted records and controlled import is idempotent", { skip: !url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: url! } } }); const marker = `clockify-audit-import-${randomBytes(6).toString("hex")}`;
  let userIds: string[] = []; let projectIds: string[] = []; let clientIds: string[] = [];
  try {
    const parsed = parseClockifyProjectCsv(`Project,Client\n${marker}-one,${marker}-client\n${marker}-two,${marker}-client\n`, 2);
    const beforeInvalid = await db.clockifyProject.count({ where: { name: { startsWith: marker } } });
    assert.throws(() => parseClockifyProjectCsv(`Project,Client\n${marker}-bad,${marker}-client\n`, 2));
    assert.equal(await db.clockifyProject.count({ where: { name: { startsWith: marker } } }), beforeInvalid);
    assert.deepEqual(await importClockifyProjects(db, parsed, true), { clients: 1, projects: 2, dryRun: true });
    const first = await importClockifyProjects(db, parsed, false); assert.equal(first.projects, 2); assert.equal(first.clients, 1);
    const second = await importClockifyProjects(db, parsed, false); assert.equal(second.projects, 0); assert.equal(second.clients, 0);
    const projects = await db.clockifyProject.findMany({ where: { name: { startsWith: marker } } }); projectIds = projects.map((project) => project.id); clientIds = [...new Set(projects.map((project) => project.clientId).filter(Boolean) as string[])];
    const [user, manager, colleague, outside] = await Promise.all([
      db.user.create({ data: { email: `${marker}@test.invalid`, role: "admin", isActive: true } }),
      db.user.create({ data: { email: `${marker}-manager@test.invalid`, role: "manager", department: "Sales", isActive: true } }),
      db.user.create({ data: { email: `${marker}-colleague@test.invalid`, role: "member", department: "Sales", isActive: true } }),
      db.user.create({ data: { email: `${marker}-outside@test.invalid`, role: "member", department: "Other", isActive: true } }),
    ]); userIds = [user.id, manager.id, colleague.id, outside.id];
    const entry = await db.clockifyEntry.create({ data: { userId: user.id, projectId: projectIds[0], workDate: new Date("2026-07-10T00:00:00Z"), startAt: new Date("2026-07-10T10:00:00Z"), endAt: new Date("2026-07-10T09:00:00Z"), durationMin: 3, description: marker } });
    await db.clockifyEntry.create({ data: { userId: user.id, projectId: projectIds[0], workDate: new Date("2026-07-10T00:00:00Z"), startAt: new Date("2026-07-10T10:30:00Z"), endAt: new Date("2026-07-10T11:00:00Z"), durationMin: 30, description: marker, deletedAt: new Date() } });
    await db.clockifyEntry.createMany({ data: [
      { userId: manager.id, projectId: projectIds[0], workDate: new Date("2026-07-10T00:00:00Z"), startAt: new Date("2026-07-10T12:00:00Z"), endAt: new Date("2026-07-10T12:03:00Z"), durationMin: 3, description: marker },
      { userId: colleague.id, projectId: projectIds[0], workDate: new Date("2026-07-10T00:00:00Z"), startAt: new Date("2026-07-10T13:00:00Z"), endAt: new Date("2026-07-10T13:03:00Z"), durationMin: 3, description: marker },
      { userId: outside.id, projectId: projectIds[0], workDate: new Date("2026-07-10T00:00:00Z"), startAt: new Date("2026-07-10T14:00:00Z"), endAt: new Date("2026-07-10T14:03:00Z"), durationMin: 3, description: marker },
    ] });
    const audit: any = await auditClockifyEntries(db, { userId: user.id, role: "admin", department: null }, normalizeClockifyAuditInput({ anomaly: "temporal_inconsistency", limit: 20 }));
    assert.equal(audit.entries.length, 1); assert.equal(audit.entries[0].id, entry.id); assert.ok(audit.entries[0].reasons.includes("temporal_inconsistency"));
    const scopedFirst: any = await auditClockifyEntries(db, { userId: manager.id, role: "manager", department: "Sales" }, normalizeClockifyAuditInput({ limit: 1 }));
    assert.equal(scopedFirst.entries.length, 1); assert.ok(scopedFirst.nextCursor); assert.equal(scopedFirst.entries[0].user.department, "Sales");
    const scopedSecond: any = await auditClockifyEntries(db, { userId: manager.id, role: "manager", department: "Sales" }, normalizeClockifyAuditInput({ limit: 1, cursor: scopedFirst.nextCursor }));
    assert.equal(scopedSecond.entries.length, 1); assert.equal(scopedSecond.entries[0].user.department, "Sales"); assert.notEqual(scopedSecond.entries[0].id, scopedFirst.entries[0].id);
  } finally {
    if (projectIds.length) await db.clockifyEntry.deleteMany({ where: { projectId: { in: projectIds } } });
    if (projectIds.length) await db.clockifyProject.deleteMany({ where: { id: { in: projectIds } } });
    if (clientIds.length) await db.clockifyClient.deleteMany({ where: { id: { in: clientIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
