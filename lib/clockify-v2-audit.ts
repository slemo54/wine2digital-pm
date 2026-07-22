import type { ClockifyV2Actor } from "./clockify-v2-api";
import { findClockifyEffectivePeriodLockIds } from "./clockify-v2-entries";
import { getClockifyReportScope } from "./clockify-v2-permissions";

type Db = any;
export const CLOCKIFY_AUDIT_ANOMALIES = ["overlap", "duration_short", "duration_long", "temporal_inconsistency", "missing_project", "missing_task", "active_lock_missing"] as const;
export type ClockifyAuditAnomaly = (typeof CLOCKIFY_AUDIT_ANOMALIES)[number];
export type ClockifyAuditInput = { anomaly: ClockifyAuditAnomaly | null; limit: number; cursor: { startAt: string; id: string } | null };
export class ClockifyAuditError extends Error { constructor(public readonly status: 400 | 403, message: string) { super(message); } }

export function normalizeClockifyAuditInput(input: Record<string, unknown>): ClockifyAuditInput {
  const raw = String(input.anomaly ?? "").trim();
  if (raw && !(CLOCKIFY_AUDIT_ANOMALIES as readonly string[]).includes(raw)) throw new ClockifyAuditError(400, "anomaly is invalid");
  const limit = input.limit === undefined || input.limit === "" ? 100 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ClockifyAuditError(400, "limit must be an integer between 1 and 200");
  if (!input.cursor) return { anomaly: raw as ClockifyAuditAnomaly || null, limit, cursor: null };
  try {
    const value = JSON.parse(Buffer.from(String(input.cursor), "base64url").toString("utf8")); const startAt = new Date(String(value.startAt));
    if (!value.id || Number.isNaN(startAt.getTime())) throw new Error("invalid");
    return { anomaly: raw as ClockifyAuditAnomaly || null, limit, cursor: { startAt: startAt.toISOString(), id: String(value.id) } };
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
  return result;
}

function encodeCursor(entry: { startAt: Date; id: string }): string { return Buffer.from(JSON.stringify({ startAt: entry.startAt.toISOString(), id: entry.id })).toString("base64url"); }

/** Read-only, bounded audit; anomaly is a distinct filter rather than a report status. */
export async function auditClockifyEntries(db: Db, actor: ClockifyV2Actor, input: ClockifyAuditInput): Promise<{ entries: unknown[]; nextCursor: string | null }> {
  const scope = getClockifyReportScope(actor);
  const scopeWhere = scope.kind === "self" ? { userId: scope.userId } : scope.kind === "department" ? { user: { department: { equals: scope.department, mode: "insensitive" } } } : {};
  const cursorWhere = input.cursor ? { OR: [{ startAt: { gt: new Date(input.cursor.startAt) } }, { startAt: new Date(input.cursor.startAt), id: { gt: input.cursor.id } }] } : {};
  const rows = await db.clockifyEntry.findMany({ where: { deletedAt: null, ...scopeWhere, ...cursorWhere }, orderBy: [{ startAt: "asc" }, { id: "asc" }], take: input.limit + 1, include: { user: { select: { id: true, name: true, email: true, department: true } }, project: { select: { id: true, name: true, client: true, isActive: true, archivedAt: true } }, clockifyTask: { select: { id: true, name: true, isActive: true } } } });
  const page = rows.slice(0, input.limit);
  const effective = await findClockifyEffectivePeriodLockIds(db, page);
  const entries = await Promise.all(page.map(async (entry: any) => {
    const overlapCount = await db.clockifyEntry.count({ where: { userId: entry.userId, deletedAt: null, NOT: { id: entry.id }, startAt: { lt: entry.endAt }, endAt: { gt: entry.startAt } } });
    const expectedLocked = entry.lockKind === "period" || !!entry.lockPeriodId;
    const effectivelyLocked = entry.lockKind === "manual" || (expectedLocked && effective.has(entry.id));
    const reasons = classifyClockifyAuditEntry({ ...entry, overlapCount, projectPresent: !!entry.project && entry.project.isActive && !entry.project.archivedAt, taskPresent: !entry.taskId || !!entry.clockifyTask && entry.clockifyTask.isActive, effectivelyLocked, expectedLocked });
    return { id: entry.id, user: entry.user, project: entry.project ? { id: entry.project.id, name: entry.project.name, client: entry.project.client } : null, task: entry.clockifyTask ? { id: entry.clockifyTask.id, name: entry.clockifyTask.name } : null, workDate: entry.workDate, startAt: entry.startAt, endAt: entry.endAt, durationMin: entry.durationMin, reasons };
  }));
  const filtered = input.anomaly ? entries.filter((entry: any) => entry.reasons.includes(input.anomaly)) : entries.filter((entry: any) => entry.reasons.length);
  return { entries: filtered, nextCursor: rows.length > input.limit && page.length ? encodeCursor(page[page.length - 1]) : null };
}
