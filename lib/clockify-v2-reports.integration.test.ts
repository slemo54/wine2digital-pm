import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { getClockifyPublicShare, normalizeClockifyReportInput, runClockifyReport } from "./clockify-v2-reports";

const url = process.env.TEST_DATABASE_URL;

test("PostgreSQL report engine: Rome filters, cursors, tag allocation, bounded groups, weekly paging, and live scope reduction", { skip: !url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: url! } } });
  const suffix = randomBytes(8).toString("hex");
  let adminId = "", managerId = "", otherId = "", blankId = "", projectId = "";
  try {
    const [admin, manager, other, blank] = await Promise.all([
      db.user.create({ data: { email: `report-admin-${suffix}@test.invalid`, role: "admin", isActive: true } }),
      db.user.create({ data: { email: `report-manager-${suffix}@test.invalid`, name: "Manager", role: "manager", department: "Grafica", isActive: true } }),
      db.user.create({ data: { email: `report-other-${suffix}@test.invalid`, name: "Zed", role: "member", department: "Grafica", isActive: true } }),
      db.user.create({ data: { email: `report-blank-${suffix}@test.invalid`, name: " ", role: "member", department: "Grafica", isActive: true } }),
    ]);
    adminId = admin.id; managerId = manager.id; otherId = other.id; blankId = blank.id;
    const project = await db.clockifyProject.create({ data: { name: `report-${suffix}`, client: "Acme", origin: "manual", color: "#000000" } }); projectId = project.id;
    const day = new Date("2026-03-29T00:00:00.000Z");
    await db.clockifyEntry.createMany({ data: [
      { userId: manager.id, projectId, workDate: day, startAt: new Date("2026-03-29T08:00:00Z"), endAt: new Date("2026-03-29T08:11:00Z"), durationMin: 11, description: "first", tags: ["a", "a", "b"] },
      { userId: other.id, projectId, workDate: day, startAt: new Date("2026-03-29T09:00:00Z"), endAt: new Date("2026-03-29T09:20:00Z"), durationMin: 20, description: "second", tags: [] },
      { userId: blank.id, projectId, workDate: day, startAt: new Date("2026-03-29T10:00:00Z"), endAt: new Date("2026-03-29T10:01:00Z"), durationMin: 1, description: "blank-name", tags: [] },
    ] });
    const input = normalizeClockifyReportInput({ reportType: "summary", from: "2026-03-29", to: "2026-03-29", groupBy: "tag", roundingIncrement: 5, roundingMode: "up" });
    const summary: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, input);
    assert.equal(summary.totalMin, 40); assert.equal(summary.bar.reduce((sum: number, row: any) => sum + row.totalMin, 0), 40);
    const detailedInput = normalizeClockifyReportInput({ reportType: "detailed", from: "2026-03-29", to: "2026-03-29", limit: 1 });
    const first: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, detailedInput);
    assert.equal(first.rows.length, 1); assert.ok(first.nextCursor);
    const second: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, normalizeClockifyReportInput({ reportType: "detailed", from: "2026-03-29", to: "2026-03-29", limit: 1, cursor: first.nextCursor }));
    assert.equal(second.rows.length, 1); assert.notEqual(second.rows[0].id, first.rows[0].id);
    const weeklySeen = new Set<string>(); let weeklyCursor: string | null = null;
    do {
      const weeklyPage: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, normalizeClockifyReportInput({ reportType: "weekly", from: "2026-03-29", to: "2026-03-29", limit: 1, ...(weeklyCursor ? { cursor: weeklyCursor } : {}) }));
      assert.equal(weeklyPage.people.length, 1); assert.equal(weeklyPage.grandTotalMin, 32); assert.equal(weeklyPage.dayTotals[0].totalMin, 32);
      assert.equal(weeklySeen.has(weeklyPage.people[0].userId), false); weeklySeen.add(weeklyPage.people[0].userId); weeklyCursor = weeklyPage.nextCursor;
    } while (weeklyCursor);
    assert.deepEqual([...weeklySeen].sort(), [manager.id, other.id, blank.id].sort());
    const token = randomBytes(32).toString("base64url");
    await db.clockifyReportShare.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), reportType: "summary", filters: { from: "2026-03-29", to: "2026-03-29" }, createdById: manager.id } });
    const detailToken = randomBytes(32).toString("base64url");
    await db.clockifyReportShare.create({ data: { tokenHash: createHash("sha256").update(detailToken).digest("hex"), reportType: "detailed", filters: { from: "2026-03-29", to: "2026-03-29" }, createdById: manager.id } });
    const publicDetail: any = await getClockifyPublicShare(db, detailToken, { limit: 1 }); assert.ok(publicDetail.report.nextCursor);
    const before: any = await getClockifyPublicShare(db, token); assert.equal(before.report.totalMin, 32);
    await db.user.update({ where: { id: manager.id }, data: { department: "Social" } });
    const reducedDepartment: any = await getClockifyPublicShare(db, token); assert.equal(reducedDepartment.report.totalMin, 0);
    const reducedCursor: any = await getClockifyPublicShare(db, detailToken, { limit: 1, cursor: publicDetail.report.nextCursor }); assert.equal(reducedCursor.report.total.totalMin, 0);
    await db.user.update({ where: { id: manager.id }, data: { department: "Grafica" } });
    await db.user.update({ where: { id: manager.id }, data: { role: "member" } });
    const after: any = await getClockifyPublicShare(db, token); assert.equal(after.report.totalMin, 11);
    await db.user.update({ where: { id: manager.id }, data: { isActive: false } });
    await assert.rejects(() => getClockifyPublicShare(db, token));
    await db.user.update({ where: { id: manager.id }, data: { isActive: true } });
    await db.clockifyReportShare.update({ where: { tokenHash: createHash("sha256").update(token).digest("hex") }, data: { revokedAt: new Date() } });
    await assert.rejects(() => getClockifyPublicShare(db, token));
    const groupEntries = Array.from({ length: 51 }, (_, index) => ({ userId: admin.id, projectId, workDate: day, startAt: new Date(`2026-03-29T11:${String(index % 60).padStart(2, "0")}:00Z`), endAt: new Date(`2026-03-29T11:${String((index + 1) % 60).padStart(2, "0")}:00Z`), durationMin: 1, description: `group-${String(index).padStart(2, "0")}`, tags: [] }));
    await db.clockifyEntry.createMany({ data: groupEntries });
    const grouped: any = await runClockifyReport(db, { userId: admin.id, role: "admin", department: null }, normalizeClockifyReportInput({ reportType: "summary", from: "2026-03-29", to: "2026-03-29", groupBy: "description" }));
    assert.equal(grouped.bar.length, 51); assert.ok(grouped.bar.some((row: any) => row.label === "Altro")); assert.equal(grouped.bar.reduce((sum: number, row: any) => sum + row.totalMin, 0), grouped.totalMin);
  } finally {
    if (projectId) await db.clockifyEntry.deleteMany({ where: { projectId } });
    if (projectId) await db.clockifyProject.deleteMany({ where: { id: projectId } });
    await db.clockifyReportShare.deleteMany({ where: { createdById: { in: [adminId, managerId, otherId, blankId].filter(Boolean) } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, managerId, otherId, blankId].filter(Boolean) } } });
    await db.$disconnect();
  }
});
