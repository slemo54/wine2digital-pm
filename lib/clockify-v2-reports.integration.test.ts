import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { getClockifyPublicShare, normalizeClockifyReportInput, runClockifyReport } from "./clockify-v2-reports";

const url = process.env.TEST_DATABASE_URL;

test("PostgreSQL report engine: Rome filters, cursors, tag allocation, CSV-equivalent totals, and live scope reduction", { skip: !url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: url! } } });
  const suffix = randomBytes(8).toString("hex");
  let adminId = "", managerId = "", otherId = "", projectId = "";
  try {
    const [admin, manager, other] = await Promise.all([
      db.user.create({ data: { email: `report-admin-${suffix}@test.invalid`, role: "admin", isActive: true } }),
      db.user.create({ data: { email: `report-manager-${suffix}@test.invalid`, role: "manager", department: "Grafica", isActive: true } }),
      db.user.create({ data: { email: `report-other-${suffix}@test.invalid`, role: "member", department: "Grafica", isActive: true } }),
    ]);
    adminId = admin.id; managerId = manager.id; otherId = other.id;
    const project = await db.clockifyProject.create({ data: { name: `report-${suffix}`, client: "Acme", origin: "manual", color: "#000000" } }); projectId = project.id;
    const day = new Date("2026-03-29T00:00:00.000Z");
    await db.clockifyEntry.createMany({ data: [
      { userId: manager.id, projectId, workDate: day, startAt: new Date("2026-03-29T08:00:00Z"), endAt: new Date("2026-03-29T08:11:00Z"), durationMin: 11, description: "first", tags: ["a", "a", "b"] },
      { userId: other.id, projectId, workDate: day, startAt: new Date("2026-03-29T09:00:00Z"), endAt: new Date("2026-03-29T09:20:00Z"), durationMin: 20, description: "second", tags: [] },
    ] });
    const input = normalizeClockifyReportInput({ reportType: "summary", from: "2026-03-29", to: "2026-03-29", groupBy: "tag", roundingIncrement: 5, roundingMode: "up" });
    const summary: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, input);
    assert.equal(summary.totalMin, 35); assert.equal(summary.bar.reduce((sum: number, row: any) => sum + row.totalMin, 0), 35);
    const detailedInput = normalizeClockifyReportInput({ reportType: "detailed", from: "2026-03-29", to: "2026-03-29", limit: 1 });
    const first: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, detailedInput);
    assert.equal(first.rows.length, 1); assert.ok(first.nextCursor);
    const second: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, normalizeClockifyReportInput({ reportType: "detailed", from: "2026-03-29", to: "2026-03-29", limit: 1, cursor: first.nextCursor }));
    assert.equal(second.rows.length, 1); assert.notEqual(second.rows[0].id, first.rows[0].id);
    const token = randomBytes(32).toString("base64url");
    await db.clockifyReportShare.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), reportType: "summary", filters: { from: "2026-03-29", to: "2026-03-29" }, createdById: manager.id } });
    const before: any = await getClockifyPublicShare(db, token); assert.equal(before.report.totalMin, 31);
    await db.user.update({ where: { id: manager.id }, data: { role: "member" } });
    const after: any = await getClockifyPublicShare(db, token); assert.equal(after.report.totalMin, 11);
  } finally {
    if (projectId) await db.clockifyEntry.deleteMany({ where: { projectId } });
    if (projectId) await db.clockifyProject.deleteMany({ where: { id: projectId } });
    await db.clockifyReportShare.deleteMany({ where: { createdById: { in: [adminId, managerId, otherId].filter(Boolean) } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, managerId, otherId].filter(Boolean) } } });
    await db.$disconnect();
  }
});
