import { normalizeDepartment } from "./departments";
import type { ClockifyV2Actor } from "./clockify-v2-api";
import { ClockifyEntryError, romeWallTimeToInstant, runClockifySerializableTransaction } from "./clockify-v2-entries";
import { canManageClockifyLocks } from "./clockify-v2-permissions";

type Db = any;
type LockScope = "all" | "department" | "user";

export class ClockifyLockError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string) { super(message); }
}

export type ClockifyLockPeriodInput = { startDate?: unknown; endDate?: unknown; scopeType?: unknown; department?: unknown; targetUserId?: unknown };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function dateAtRomeMidnight(value: unknown, label: string): Date {
  const date = String(value ?? "").trim();
  if (!datePattern.test(date)) throw new ClockifyLockError(400, `${label} must be YYYY-MM-DD`);
  try { return romeWallTimeToInstant(date, "00:00"); }
  catch { throw new ClockifyLockError(400, `${label} is invalid`); }
}

async function normalizeInput(input: ClockifyLockPeriodInput): Promise<{ startDate: Date; endDate: Date; scopeType: LockScope; department: string | null; targetUserId: string | null }> {
  const startDate = dateAtRomeMidnight(input.startDate, "startDate");
  const endDate = dateAtRomeMidnight(input.endDate, "endDate");
  if (startDate > endDate) throw new ClockifyLockError(400, "startDate must be on or before endDate");
  const scopeType = String(input.scopeType ?? "").trim().toLowerCase() as LockScope;
  if (scopeType !== "all" && scopeType !== "department" && scopeType !== "user") throw new ClockifyLockError(400, "scopeType must be all, department, or user");
  const targetUserId = String(input.targetUserId ?? "").trim() || null;
  const department = await normalizeDepartment(input.department);
  const suppliedDepartment = input.department !== undefined && input.department !== null && String(input.department).trim() !== "";
  const suppliedTarget = input.targetUserId !== undefined && input.targetUserId !== null && String(input.targetUserId).trim() !== "";
  if (scopeType === "all" && (suppliedDepartment || suppliedTarget)) throw new ClockifyLockError(400, "all scope cannot have a department or user target");
  if (scopeType === "department" && (!department || suppliedTarget)) throw new ClockifyLockError(400, "department scope requires only a valid department");
  if (scopeType === "user" && (!targetUserId || suppliedDepartment)) throw new ClockifyLockError(400, "user scope requires only targetUserId");
  return { startDate, endDate, scopeType, department: scopeType === "department" ? department : null, targetUserId: scopeType === "user" ? targetUserId : null };
}

function requireAdmin(actor: ClockifyV2Actor): void {
  if (!canManageClockifyLocks(actor.role)) throw new ClockifyLockError(403, "Forbidden");
}

async function targetUserIds(tx: Db, lock: { scopeType: LockScope; department: string | null; targetUserId: string | null }): Promise<string[] | null> {
  if (lock.scopeType === "all") return null;
  if (lock.scopeType === "user") return [lock.targetUserId!];
  const users = await tx.user.findMany({ where: { department: { equals: lock.department!, mode: "insensitive" } }, select: { id: true, department: true } });
  const normalized = await Promise.all(users.map(async (user: { id: string; department: unknown }) => (await normalizeDepartment(user.department)) === lock.department ? user.id : null));
  return normalized.filter((id): id is string => !!id);
}

function periodEntryWhere(lock: { startDate: Date; endDate: Date; scopeType: LockScope; department: string | null; targetUserId: string | null }, userIds: string[] | null): Record<string, unknown> {
  return { deletedAt: null, workDate: { gte: lock.startDate, lte: lock.endDate }, lockedAt: null, lockKind: null, ...(userIds ? { userId: { in: userIds } } : {}) };
}

export async function createClockifyLockPeriod(db: Db, actor: ClockifyV2Actor, input: ClockifyLockPeriodInput): Promise<unknown> {
  requireAdmin(actor);
  const lock = await normalizeInput(input);
  return runClockifySerializableTransaction(db, async (tx) => {
    if (lock.scopeType === "user" && typeof tx.user?.findUnique === "function") {
      const target = await tx.user.findUnique({ where: { id: lock.targetUserId! }, select: { id: true } });
      if (!target) throw new ClockifyLockError(404, "Target user not found");
    }
    const period = await tx.clockifyLockPeriod.create({ data: { ...lock, createdById: actor.userId } });
    const userIds = await targetUserIds(tx, lock);
    if (!userIds || userIds.length > 0) await tx.clockifyEntry.updateMany({ where: periodEntryWhere(lock, userIds), data: { lockedAt: new Date(), lockedById: actor.userId, lockKind: "period", lockPeriodId: period.id } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.lock-period.create", entityType: "ClockifyLockPeriod", entityId: period.id, metadata: { ...lock } } });
    return period;
  });
}

export async function listClockifyLockPeriods(db: Db, actor: ClockifyV2Actor): Promise<unknown[]> {
  requireAdmin(actor);
  return db.clockifyLockPeriod.findMany({ orderBy: [{ unlockedAt: "asc" }, { startDate: "desc" }], select: { id: true, startDate: true, endDate: true, scopeType: true, department: true, targetUserId: true, createdById: true, createdAt: true, unlockedAt: true, unlockedById: true } });
}

export async function unlockClockifyLockPeriod(db: Db, actor: ClockifyV2Actor, periodId: string): Promise<unknown> {
  requireAdmin(actor);
  return runClockifySerializableTransaction(db, async (tx) => {
    const period = await tx.clockifyLockPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new ClockifyLockError(404, "Lock period not found");
    if (period.unlockedAt) throw new ClockifyLockError(409, "Lock period is already unlocked");
    await tx.clockifyEntry.updateMany({ where: { lockKind: "period", lockPeriodId: periodId }, data: { lockedAt: null, lockedById: null, lockKind: null, lockPeriodId: null } });
    const unlocked = await tx.clockifyLockPeriod.update({ where: { id: periodId }, data: { unlockedAt: new Date(), unlockedById: actor.userId } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.lock-period.unlock", entityType: "ClockifyLockPeriod", entityId: periodId, metadata: {} } });
    return unlocked;
  });
}

async function mutateManualLock(db: Db, actor: ClockifyV2Actor, entryId: string, locked: boolean): Promise<unknown> {
  requireAdmin(actor);
  return runClockifySerializableTransaction(db, async (tx) => {
    const entry = await tx.clockifyEntry.findUnique({ where: { id: entryId }, select: { id: true, deletedAt: true, lockKind: true, lockPeriodId: true } });
    if (!entry || entry.deletedAt) throw new ClockifyLockError(404, "Entry not found");
    if (!locked && entry.lockKind === "period") throw new ClockifyLockError(409, "This entry is locked by a reporting period");
    const result = await tx.clockifyEntry.update({ where: { id: entryId }, data: locked ? { lockedAt: new Date(), lockedById: actor.userId, lockKind: "manual", lockPeriodId: null } : { lockedAt: null, lockedById: null, lockKind: null, lockPeriodId: null } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: `clockify.entry.${locked ? "lock" : "unlock"}`, entityType: "ClockifyEntry", entityId: entryId, metadata: {} } });
    return result;
  });
}

export const lockClockifyEntry = (db: Db, actor: ClockifyV2Actor, entryId: string): Promise<unknown> => mutateManualLock(db, actor, entryId, true);
export const unlockClockifyEntry = (db: Db, actor: ClockifyV2Actor, entryId: string): Promise<unknown> => mutateManualLock(db, actor, entryId, false);

export function asClockifyLockError(error: unknown): ClockifyLockError | ClockifyEntryError | null { return error instanceof ClockifyLockError || error instanceof ClockifyEntryError ? error : null; }
