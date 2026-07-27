import { Prisma } from "@prisma/client";
import type { ClockifyV2Actor } from "./clockify-v2-api";
import { canonicalizeClockifyActor } from "./clockify-v2-entries";
import { getClockifyReportScope } from "./clockify-v2-permissions";
import { buildClockifyReportWhere, ClockifyReportError, normalizeClockifyReportInput, type ClockifyReportFilters } from "./clockify-v2-reports";

type Db = any;
export const CLOCKIFY_AUDIT_ANOMALIES = ["overlap", "duration_short", "duration_long", "temporal_inconsistency", "missing_project", "missing_task", "active_lock_missing", "unlocked"] as const;
export type ClockifyAuditAnomaly = (typeof CLOCKIFY_AUDIT_ANOMALIES)[number];
export type ClockifyAuditInput = { anomaly: ClockifyAuditAnomaly | null; limit: number; cursor: { startAt: string; id: string } | null; filters: ClockifyReportFilters | null };
export class ClockifyAuditError extends Error { constructor(public readonly status: 400 | 403, message: string) { super(message); } }

export function normalizeClockifyAuditInput(input: Record<string, unknown>): ClockifyAuditInput {
  const raw = String(input.anomaly ?? "").trim();
  if (raw && !(CLOCKIFY_AUDIT_ANOMALIES as readonly string[]).includes(raw)) throw new ClockifyAuditError(400, "anomaly is invalid");
  const limit = input.limit === undefined || input.limit === "" ? 100 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ClockifyAuditError(400, "limit must be an integer between 1 and 200");
  let filters: ClockifyReportFilters | null = null;
  if (input.from !== undefined || input.to !== undefined) {
    if (!input.from || !input.to) throw new ClockifyAuditError(400, "from and to must be provided together");
    try {
      filters = normalizeClockifyReportInput({ ...input, reportType: "detailed" }).filters;
    } catch (error) {
      if (error instanceof ClockifyReportError) throw new ClockifyAuditError(400, error.message);
      throw error;
    }
  }
  if (!input.cursor) return { anomaly: raw as ClockifyAuditAnomaly || null, limit, cursor: null, filters };
  try {
    const value = JSON.parse(Buffer.from(String(input.cursor), "base64url").toString("utf8")); const startAt = new Date(String(value.startAt));
    if (!value.id || Number.isNaN(startAt.getTime())) throw new Error("invalid");
    return { anomaly: raw as ClockifyAuditAnomaly || null, limit, cursor: { startAt: startAt.toISOString(), id: String(value.id) }, filters };
  } catch { throw new ClockifyAuditError(400, "cursor is invalid"); }
}

export function classifyClockifyAuditEntry(input: { deletedAt: Date | null; startAt: Date; endAt: Date; durationMin: number; overlapCount: number; projectPresent: boolean; taskPresent: boolean; effectivelyLocked: boolean; expectedLocked: boolean }): ClockifyAuditAnomaly[] {
  if (input.deletedAt) return [];
  const result: ClockifyAuditAnomaly[] = [];
  if (input.overlapCount > 0) result.push("overlap");
  if (input.durationMin < 5) result.push("duration_short");
  if (input.durationMin > 12 * 60) result.push("duration_long");
  if (input.endAt.getTime() <= input.startAt.getTime() || Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60000) !== input.durationMin) result.push("temporal_inconsistency");
  if (!input.projectPresent) result.push("missing_project");
  if (!input.taskPresent) result.push("missing_task");
  if (input.expectedLocked && !input.effectivelyLocked) result.push("active_lock_missing");
  if (!input.effectivelyLocked) result.push("unlocked");
  return result;
}

function encodeCursor(entry: { startAt: Date; id: string }): string { return Buffer.from(JSON.stringify({ startAt: entry.startAt.toISOString(), id: entry.id })).toString("base64url"); }

export function isAuditPeriodEffectivelyLocked(entry: { lockKind: string | null; lockPeriodId: string | null; workDate: Date; userId: string; department: string | null }, period: { id: string; unlockedAt: Date | null; startDate: Date; endDate: Date; scopeType: string; targetUserId: string | null; department: string | null } | null): boolean {
  if (entry.lockKind === "manual") return true;
  if (entry.lockKind !== "period" || !entry.lockPeriodId || !period || period.id !== entry.lockPeriodId || period.unlockedAt) return false;
  if (period.startDate > entry.workDate || period.endDate < entry.workDate) return false;
  return period.scopeType === "all" || (period.scopeType === "user" && period.targetUserId === entry.userId) || (period.scopeType === "department" && !!entry.department && period.department?.trim().toLowerCase() === entry.department.trim().toLowerCase());
}

async function normalizeAuditDepartment(db: Db, value: unknown): Promise<string | null> {
  const requested = String(value ?? "").normalize("NFKC").trim(); if (!requested) return null;
  const fallback = ["Backoffice", "IT", "Grafica", "Social"];
  const departments = typeof db.workSettings?.findFirst === "function" ? ((await db.workSettings.findFirst({ select: { departments: true } }))?.departments || fallback) : fallback;
  return departments.find((department: string) => department.toLocaleLowerCase("it-IT") === requested.toLocaleLowerCase("it-IT")) || null;
}

/** Read-only, bounded audit; anomaly is a distinct filter rather than a report status. */
export async function auditClockifyEntries(db: Db, actor: ClockifyV2Actor, input: ClockifyAuditInput): Promise<{ entries: unknown[]; nextCursor: string | null }> {
  const canonical = await canonicalizeClockifyActor(actor, (value) => normalizeAuditDepartment(db, value));
  const scope = getClockifyReportScope(canonical);
  const scopeSql = input.filters
    ? await buildClockifyReportWhere(canonical, input.filters, (value) => normalizeAuditDepartment(db, value))
    : scope.kind === "self"
      ? Prisma.sql`e."deletedAt" IS NULL AND e."userId" = ${scope.userId}`
      : scope.kind === "department"
        ? Prisma.sql`e."deletedAt" IS NULL AND lower(btrim(u.department)) = lower(btrim(${scope.department}))`
        : Prisma.sql`e."deletedAt" IS NULL`;
  const cursorSql = input.cursor ? Prisma.sql`AND ("startAt" < ${new Date(input.cursor.startAt)} OR ("startAt" = ${new Date(input.cursor.startAt)} AND id < ${input.cursor.id}))` : Prisma.empty;
  const anomalySql = input.anomaly ? Prisma.sql`AND ${input.anomaly} = ANY(reasons)` : Prisma.empty;
  const rows: any[] = await db.$queryRaw(Prisma.sql`
    WITH audited AS (
      SELECT e.id, e."userId", e."workDate", e."startAt", e."endAt", e."durationMin", u.name AS "userName", u.email AS "userEmail", u.department AS "userDepartment", p.id AS "projectId", p.name AS "projectName", p.client AS "projectClient", t.id AS "taskId", t.name AS "taskName",
      array_remove(ARRAY[
        CASE WHEN EXISTS (SELECT 1 FROM "ClockifyEntry" o WHERE o."deletedAt" IS NULL AND o."userId" = e."userId" AND o.id <> e.id AND o."startAt" < e."endAt" AND o."endAt" > e."startAt") THEN 'overlap' END,
        CASE WHEN e."durationMin" < 5 THEN 'duration_short' END, CASE WHEN e."durationMin" > 720 THEN 'duration_long' END,
        CASE WHEN e."endAt" <= e."startAt" OR round(extract(epoch FROM (e."endAt" - e."startAt")) / 60) <> e."durationMin" THEN 'temporal_inconsistency' END,
        CASE WHEN p.id IS NULL THEN 'missing_project' END,
        CASE WHEN e."taskId" IS NOT NULL AND t.id IS NULL THEN 'missing_task' END,
        CASE WHEN e."lockKind" = 'period' AND NOT EXISTS (SELECT 1 FROM "ClockifyLockPeriod" lp WHERE lp.id = e."lockPeriodId" AND lp."unlockedAt" IS NULL AND lp."startDate" <= e."workDate" AND lp."endDate" >= e."workDate" AND (lp."scopeType" = 'all' OR (lp."scopeType" = 'user' AND lp."targetUserId" = e."userId") OR (lp."scopeType" = 'department' AND u.department IS NOT NULL AND lower(btrim(lp.department)) = lower(btrim(u.department))))) THEN 'active_lock_missing' END,
        CASE WHEN e."lockedAt" IS NULL AND e."lockKind" IS DISTINCT FROM 'manual' AND NOT EXISTS (SELECT 1 FROM "ClockifyLockPeriod" lp WHERE lp."unlockedAt" IS NULL AND lp."startDate" <= e."workDate" AND lp."endDate" >= e."workDate" AND (lp."scopeType" = 'all' OR (lp."scopeType" = 'user' AND lp."targetUserId" = e."userId") OR (lp."scopeType" = 'department' AND u.department IS NOT NULL AND lower(btrim(lp.department)) = lower(btrim(u.department))))) THEN 'unlocked' END
      ], NULL) AS reasons
      FROM "ClockifyEntry" e JOIN "User" u ON u.id = e."userId" LEFT JOIN "ClockifyProject" p ON p.id = e."projectId" LEFT JOIN "ClockifyTask" t ON t.id = e."taskId"
      WHERE ${scopeSql}
    ) SELECT * FROM audited WHERE cardinality(reasons) > 0 ${anomalySql} ${cursorSql} ORDER BY "startAt" DESC, id DESC LIMIT ${input.limit + 1}`);
  const page = rows.slice(0, input.limit);
  return { entries: page.map((row) => ({ id: row.id, user: { id: row.userId, name: row.userName, email: row.userEmail, department: row.userDepartment }, project: row.projectId ? { id: row.projectId, name: row.projectName, client: row.projectClient } : null, task: row.taskId ? { id: row.taskId, name: row.taskName } : null, workDate: row.workDate, startAt: row.startAt, endAt: row.endAt, durationMin: Number(row.durationMin), reasons: row.reasons })), nextCursor: rows.length > input.limit && page.length ? encodeCursor(page[page.length - 1]) : null };
}
