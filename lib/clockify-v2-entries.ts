import { normalizeDepartment } from "./departments";
import { Prisma } from "@prisma/client";
import type { ClockifyV2Actor } from "./clockify-v2-api";
import { ClockifyCatalogError } from "./clockify-v2-catalog";
import { getClockifyReportScope } from "./clockify-v2-permissions";

type Db = any;

export type ClockifyEntryWarning = {
  code: "overlap" | "duration_short" | "duration_long";
  message: string;
};

export class ClockifyEntryError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

export type ClockifyEntryInput = {
  projectId?: unknown;
  taskId?: unknown;
  description?: unknown;
  tags?: unknown;
  billable?: unknown;
  date?: unknown;
  startTime?: unknown;
  endAt?: unknown;
  durationMin?: unknown;
};

const ROME = "Europe/Rome";
/**
 * Invariant: every entry mutation and every period-lock writer must run through
 * `runClockifySerializableTransaction`. PostgreSQL holds this advisory lock for
 * the transaction, so a lock cannot commit between an entry lock check and its
 * write (or vice versa). It is deliberately global until Phase 4 can safely
 * partition by normalized scope/date.
 */
export const CLOCKIFY_LOCK_PROTOCOL = "clockify-v2:entry-and-period-lock";
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})$/;
const entrySelect = {
  id: true, userId: true, projectId: true, taskId: true, workDate: true, description: true,
  task: true, tags: true, billable: true, startAt: true, endAt: true, durationMin: true,
  lockedAt: true, lockKind: true, lockPeriodId: true, deletedAt: true, deletedById: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true, email: true, department: true } },
  project: { select: { id: true, name: true, client: true, isActive: true, color: true } },
  clockifyTask: { select: { id: true, name: true, isActive: true } },
};

function asDatePart(value: unknown): { year: number; month: number; day: number; value: string } {
  const match = datePattern.exec(String(value ?? "").trim());
  if (!match) throw new ClockifyEntryError(400, "date must be YYYY-MM-DD");
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const valid = new Date(Date.UTC(year, month - 1, day));
  if (valid.getUTCFullYear() !== year || valid.getUTCMonth() !== month - 1 || valid.getUTCDate() !== day) {
    throw new ClockifyEntryError(400, "date is invalid");
  }
  return { year, month, day, value: String(value).trim() };
}

function asTimePart(value: unknown, label: string): { hour: number; minute: number } {
  const match = timePattern.exec(String(value ?? "").trim());
  if (!match) throw new ClockifyEntryError(400, `${label} must be HH:mm`);
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new ClockifyEntryError(400, `${label} is invalid`);
  return { hour, minute };
}

function nextDate(value: string): string {
  const date = asDatePart(value);
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function romeParts(value: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** Maps a Rome wall-clock minute to the first matching instant. The minute scan rejects DST gaps and makes repeated autumn minutes deterministic. */
export function romeWallTimeToInstant(dateValue: unknown, timeValue: unknown): Date {
  const date = asDatePart(dateValue), time = asTimePart(timeValue, "startTime");
  const desiredDate = date.value, desiredTime = `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
  const center = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  for (let offset = -4 * 60; offset <= 4 * 60; offset += 1) {
    const candidate = new Date(center + offset * 60_000);
    const local = romeParts(candidate);
    if (local.date === desiredDate && local.time === desiredTime) return candidate;
  }
  throw new ClockifyEntryError(400, `The selected Europe/Rome time does not exist: ${desiredDate} ${desiredTime}`);
}

export function parseClockifySplitAt(input: { splitDate?: unknown; splitTime?: unknown }): Date {
  return romeWallTimeToInstant(input.splitDate, input.splitTime);
}

export type CanonicalClockifyActor = ClockifyV2Actor & { department: string | null };

/** Shared with Phase 4 period-lock writers; never compare departments as raw session text. */
export async function canonicalizeClockifyActor(
  actor: ClockifyV2Actor,
  normalizer: (department: unknown) => Promise<string | null> = normalizeDepartment,
): Promise<CanonicalClockifyActor> {
  return { ...actor, department: await normalizer(actor.department) };
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && (
    ("code" in error && ((error as { code?: string }).code === "P2034" || (error as { code?: string }).code === "40001"))
    || /serialization/i.test(String((error as { message?: string }).message || ""))
  );
}

export async function acquireClockifyLockProtocol(tx: Db): Promise<void> {
  if (typeof tx.$queryRawUnsafe === "function") {
    await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", CLOCKIFY_LOCK_PROTOCOL);
  }
}

/** Shared transaction protocol for entry mutations and future period-lock creation. */
export async function runClockifySerializableTransaction<T>(db: Db, work: (tx: Db) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx: Db) => {
        await acquireClockifyLockProtocol(tx);
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Clockify serializable transaction exhausted unexpectedly");
}

export function buildClockifyEntryTiming(input: Pick<ClockifyEntryInput, "date" | "startTime" | "endAt" | "durationMin">): { startAt: Date; endAt: Date; durationMin: number; workDate: Date } {
  const hasEnd = input.endAt !== undefined && input.endAt !== null && String(input.endAt).trim() !== "";
  const hasDuration = input.durationMin !== undefined && input.durationMin !== null && String(input.durationMin).trim() !== "";
  if (hasEnd === hasDuration) throw new ClockifyEntryError(400, "Provide exactly one of endAt or durationMin");
  const date = asDatePart(input.date);
  const startTime = asTimePart(input.startTime, "startTime");
  const startAt = romeWallTimeToInstant(date.value, `${String(startTime.hour).padStart(2, "0")}:${String(startTime.minute).padStart(2, "0")}`);
  const workDate = romeWallTimeToInstant(date.value, "00:00");
  let endAt: Date;
  if (hasDuration) {
    const durationMin = Number(input.durationMin);
    if (!Number.isInteger(durationMin) || durationMin <= 0 || durationMin > 7 * 24 * 60) throw new ClockifyEntryError(400, "durationMin must be a positive whole number of minutes");
    endAt = new Date(startAt.getTime() + durationMin * 60_000);
  } else {
    const endTime = asTimePart(input.endAt, "endAt");
    const endValue = `${String(endTime.hour).padStart(2, "0")}:${String(endTime.minute).padStart(2, "0")}`;
    endAt = romeWallTimeToInstant(date.value, endValue);
    if (endAt.getTime() <= startAt.getTime()) endAt = romeWallTimeToInstant(nextDate(date.value), endValue);
  }
  const durationMin = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
  if (durationMin <= 0) throw new ClockifyEntryError(400, "endAt must be after startTime");
  return { startAt, endAt, durationMin, workDate };
}

function normalizeInput(input: ClockifyEntryInput): { projectId: string; taskId: string | null; description: string; tags: string[]; billable: boolean; timing: ReturnType<typeof buildClockifyEntryTiming> } {
  const projectId = String(input.projectId ?? "").trim();
  const taskId = String(input.taskId ?? "").trim() || null;
  const description = String(input.description ?? "").normalize("NFKC").trim();
  if (!projectId) throw new ClockifyEntryError(400, "projectId is required");
  if (!description) throw new ClockifyEntryError(400, "description is required");
  if (description.length > 2000) throw new ClockifyEntryError(400, "description is too long");
  if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== "string")) throw new ClockifyEntryError(400, "tags must be an array of strings");
  const tags = [...new Set(input.tags.map((tag) => tag.normalize("NFKC").trim()).filter(Boolean))];
  if (tags.length > 30 || tags.some((tag) => tag.length > 80)) throw new ClockifyEntryError(400, "too many or invalid tags");
  if (typeof input.billable !== "boolean") throw new ClockifyEntryError(400, "billable must be a boolean");
  return { projectId, taskId, description, tags, billable: input.billable, timing: buildClockifyEntryTiming(input) };
}

export function entryWarnings(input: { startAt: Date; endAt: Date; durationMin: number; overlaps: number }): ClockifyEntryWarning[] {
  const warnings: ClockifyEntryWarning[] = [];
  if (input.overlaps > 0) warnings.push({ code: "overlap", message: "This entry overlaps an existing entry." });
  if (input.durationMin < 5) warnings.push({ code: "duration_short", message: "Duration is shorter than 5 minutes." });
  if (input.durationMin > 12 * 60) warnings.push({ code: "duration_long", message: "Duration is longer than 12 hours." });
  return warnings;
}

function periodEnd(workDate: Date): Date {
  const local = romeParts(workDate);
  return romeWallTimeToInstant(nextDate(local.date), "00:00");
}

function lockAppliesToWorkDate(lock: { startDate: Date; endDate: Date; scopeType: string; department: string | null; targetUserId: string | null }, actor: CanonicalClockifyActor, workDate: Date): boolean {
  if (lock.startDate.getTime() >= periodEnd(workDate).getTime() || lock.endDate.getTime() < workDate.getTime()) return false;
  return lock.scopeType === "all" || (lock.scopeType === "department" && !!actor.department && lock.department === actor.department) || (lock.scopeType === "user" && lock.targetUserId === actor.userId);
}

/** This predicate is invoked from every write transaction, including future-date creates. */
export async function assertClockifyEntryUnlocked(db: Db, actor: ClockifyV2Actor, workDate: Date, entry?: { lockedAt?: Date | null; lockKind?: string | null }): Promise<void> {
  if (entry?.lockedAt || entry?.lockKind) throw new ClockifyEntryError(409, "This entry is locked");
  const canonicalActor = await canonicalizeClockifyActor(actor);
  const lock = await db.clockifyLockPeriod.findFirst({
    where: {
      unlockedAt: null,
      startDate: { lt: periodEnd(workDate) },
      endDate: { gte: workDate },
      OR: [
        { scopeType: "all" },
        ...(canonicalActor.department ? [{ scopeType: "department", department: canonicalActor.department }] : []),
        { scopeType: "user", targetUserId: canonicalActor.userId },
      ],
    },
    select: { id: true },
  });
  if (lock) throw new ClockifyEntryError(409, "This reporting period is locked");
}

async function validateReferences(db: Db, data: ReturnType<typeof normalizeInput>): Promise<void> {
  const project = await db.clockifyProject.findUnique({ where: { id: data.projectId }, select: { id: true, isActive: true, archivedAt: true } });
  if (!project || !project.isActive || project.archivedAt) throw new ClockifyEntryError(400, "Project must be active and not archived");
  if (data.taskId) {
    const task = await db.clockifyTask.findFirst({ where: { id: data.taskId, projectId: data.projectId, isActive: true }, select: { id: true, name: true } });
    if (!task) throw new ClockifyEntryError(400, "Task must be active and belong to the selected project");
  }
}

async function countOverlaps(db: Db, userId: string, startAt: Date, endAt: Date, excludeId?: string): Promise<number> {
  return db.clockifyEntry.count({ where: { userId, deletedAt: null, ...(excludeId ? { NOT: { id: excludeId } } : {}), startAt: { lt: endAt }, endAt: { gt: startAt } } });
}

async function createInTransaction(db: Db, actor: ClockifyV2Actor, raw: ClockifyEntryInput, action = "clockify.entry.create"): Promise<{ entry: unknown; warnings: ClockifyEntryWarning[] }> {
  const data = normalizeInput(raw);
  await validateReferences(db, data);
  await assertClockifyEntryUnlocked(db, actor, data.timing.workDate);
  const overlaps = await countOverlaps(db, actor.userId, data.timing.startAt, data.timing.endAt);
  const task = data.taskId ? await db.clockifyTask.findUnique({ where: { id: data.taskId }, select: { name: true } }) : null;
  const entry = await db.clockifyEntry.create({ data: { userId: actor.userId, projectId: data.projectId, taskId: data.taskId, task: task?.name || null, description: data.description, tags: data.tags, billable: data.billable, ...data.timing }, select: entrySelect });
  await db.auditLog.create({ data: { actorId: actor.userId, actionType: action, entityType: "ClockifyEntry", entityId: entry.id, metadata: { projectId: data.projectId, taskId: data.taskId, durationMin: data.timing.durationMin } } });
  return { entry, warnings: entryWarnings({ ...data.timing, overlaps }) };
}

export async function createClockifyEntry(db: Db, actor: ClockifyV2Actor, input: ClockifyEntryInput): Promise<{ entry: unknown; warnings: ClockifyEntryWarning[] }> {
  return runClockifySerializableTransaction(db, (tx) => createInTransaction(tx, actor, input));
}

async function requireOwnEntry(db: Db, actor: ClockifyV2Actor, entryId: string): Promise<any> {
  const entry = await db.clockifyEntry.findFirst({ where: { id: entryId, userId: actor.userId, deletedAt: null }, select: entrySelect });
  if (!entry) throw new ClockifyEntryError(404, "Entry not found");
  return entry;
}

export async function updateClockifyEntry(db: Db, actor: ClockifyV2Actor, entryId: string, input: ClockifyEntryInput): Promise<{ entry: unknown; warnings: ClockifyEntryWarning[] }> {
  return runClockifySerializableTransaction(db, async (tx: Db) => {
    const current = await requireOwnEntry(tx, actor, entryId);
    const data = normalizeInput(input);
    await assertClockifyEntryUnlocked(tx, actor, current.workDate, current);
    await assertClockifyEntryUnlocked(tx, actor, data.timing.workDate);
    await validateReferences(tx, data);
    const overlaps = await countOverlaps(tx, actor.userId, data.timing.startAt, data.timing.endAt, entryId);
    const task = data.taskId ? await tx.clockifyTask.findUnique({ where: { id: data.taskId }, select: { name: true } }) : null;
    const entry = await tx.clockifyEntry.update({ where: { id: entryId }, data: { projectId: data.projectId, taskId: data.taskId, task: task?.name || null, description: data.description, tags: data.tags, billable: data.billable, ...data.timing }, select: entrySelect });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.entry.update", entityType: "ClockifyEntry", entityId: entryId, metadata: { durationMin: data.timing.durationMin } } });
    return { entry, warnings: entryWarnings({ ...data.timing, overlaps }) };
  });
}

export async function deleteClockifyEntry(db: Db, actor: ClockifyV2Actor, entryId: string): Promise<void> {
  await runClockifySerializableTransaction(db, async (tx: Db) => {
    const entry = await requireOwnEntry(tx, actor, entryId);
    await assertClockifyEntryUnlocked(tx, actor, entry.workDate, entry);
    await tx.clockifyEntry.update({ where: { id: entryId }, data: { deletedAt: new Date(), deletedById: actor.userId } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.entry.delete", entityType: "ClockifyEntry", entityId: entryId, metadata: {} } });
  });
}

export async function duplicateClockifyEntry(db: Db, actor: ClockifyV2Actor, entryId: string, override: Pick<ClockifyEntryInput, "date" | "startTime" | "endAt" | "durationMin">): Promise<{ entry: unknown; warnings: ClockifyEntryWarning[] }> {
  return runClockifySerializableTransaction(db, async (tx: Db) => {
    const source = await requireOwnEntry(tx, actor, entryId);
    await assertClockifyEntryUnlocked(tx, actor, source.workDate, source);
    const duplicated = await createInTransaction(tx, actor, { projectId: source.projectId, taskId: source.taskId, description: source.description, tags: source.tags, billable: source.billable, ...override }, "clockify.entry.duplicate");
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.entry.duplicate.source", entityType: "ClockifyEntry", entityId: entryId, metadata: { duplicateId: (duplicated.entry as { id: string }).id } } });
    return duplicated;
  });
}

export async function splitClockifyEntry(db: Db, actor: ClockifyV2Actor, entryId: string, input: { splitDate?: unknown; splitTime?: unknown }): Promise<{ original: unknown; second: unknown; warnings: ClockifyEntryWarning[] }> {
  return runClockifySerializableTransaction(db, async (tx: Db) => {
    const source = await requireOwnEntry(tx, actor, entryId);
    await assertClockifyEntryUnlocked(tx, actor, source.workDate, source);
    const splitAt = parseClockifySplitAt(input);
    const sourceDuration = (source.endAt.getTime() - source.startAt.getTime()) / 60_000;
    if (source.startAt.getTime() % 60_000 !== 0 || source.endAt.getTime() % 60_000 !== 0 || !Number.isInteger(sourceDuration) || source.durationMin !== sourceDuration) throw new ClockifyEntryError(400, "Entry timestamps must have exact minute precision before splitting");
    if (splitAt.getTime() <= source.startAt.getTime() || splitAt.getTime() >= source.endAt.getTime()) throw new ClockifyEntryError(400, "splitAt must be strictly inside the entry");
    const firstDuration = (splitAt.getTime() - source.startAt.getTime()) / 60_000;
    const secondDuration = (source.endAt.getTime() - splitAt.getTime()) / 60_000;
    if (!Number.isInteger(firstDuration) || !Number.isInteger(secondDuration) || firstDuration <= 0 || secondDuration <= 0 || firstDuration + secondDuration !== source.durationMin) throw new ClockifyEntryError(400, "splitAt must fall on an exact entry minute");
    const original = await tx.clockifyEntry.update({ where: { id: entryId }, data: { endAt: splitAt, durationMin: firstDuration }, select: entrySelect });
    const second = await tx.clockifyEntry.create({ data: { userId: source.userId, projectId: source.projectId, taskId: source.taskId, task: source.task, description: source.description, tags: source.tags, billable: source.billable, workDate: source.workDate, startAt: splitAt, endAt: source.endAt, durationMin: secondDuration }, select: entrySelect });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.entry.split", entityType: "ClockifyEntry", entityId: entryId, metadata: { secondEntryId: second.id, splitAt: splitAt.toISOString(), durationMin: firstDuration } } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.entry.split", entityType: "ClockifyEntry", entityId: second.id, metadata: { originalEntryId: entryId, splitAt: splitAt.toISOString(), durationMin: secondDuration } } });
    return { original, second, warnings: entryWarnings({ startAt: splitAt, endAt: source.endAt, durationMin: secondDuration, overlaps: 0 }) };
  });
}

function weekStart(date: string): string {
  const parsed = asDatePart(date);
  const value = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function groupClockifyEntries<T extends { workDate: Date; durationMin: number; billable: boolean }>(entries: T[]): { days: Array<{ date: string; entries: T[]; totalMin: number; billableMin: number }>; weeks: Array<{ startDate: string; totalMin: number; billableMin: number }>; period: { totalMin: number; billableMin: number } } {
  const byDay = new Map<string, T[]>();
  for (const entry of entries) { const key = romeParts(entry.workDate).date; byDay.set(key, [...(byDay.get(key) || []), entry]); }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, dayEntries]) => ({ date, entries: dayEntries, totalMin: dayEntries.reduce((sum, entry) => sum + entry.durationMin, 0), billableMin: dayEntries.reduce((sum, entry) => sum + (entry.billable ? entry.durationMin : 0), 0) }));
  const byWeek = new Map<string, { totalMin: number; billableMin: number }>();
  for (const day of days) { const key = weekStart(day.date); const current = byWeek.get(key) || { totalMin: 0, billableMin: 0 }; current.totalMin += day.totalMin; current.billableMin += day.billableMin; byWeek.set(key, current); }
  const totalMin = days.reduce((sum, day) => sum + day.totalMin, 0), billableMin = days.reduce((sum, day) => sum + day.billableMin, 0);
  return { days, weeks: [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([startDate, values]) => ({ startDate, ...values })), period: { totalMin, billableMin } };
}

type ClockifyEntryCursor = { startAt: string; id: string };
function parseEntryCursor(value: unknown): ClockifyEntryCursor | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const startAt = new Date(String(parsed?.startAt || "")); const id = String(parsed?.id || "");
    if (!id || Number.isNaN(startAt.getTime())) throw new Error("bad cursor");
    return { startAt: startAt.toISOString(), id };
  } catch { throw new ClockifyEntryError(400, "cursor is invalid"); }
}

function parsePageLimit(value: unknown): number {
  if (value === undefined || value === null || String(value).trim() === "") return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new ClockifyEntryError(400, "limit must be an integer between 1 and 500");
  return limit;
}

async function effectivePeriodLock(db: Db, entry: any): Promise<boolean> {
  if (entry.lockedAt || entry.lockKind || typeof db.clockifyLockPeriod?.findFirst !== "function") return false;
  const canonical = await canonicalizeClockifyActor({ userId: entry.userId, role: "member", department: entry.user?.department || null });
  const lock = await db.clockifyLockPeriod.findFirst({
    where: {
      unlockedAt: null, startDate: { lte: entry.workDate }, endDate: { gte: entry.workDate },
      OR: [{ scopeType: "all" }, ...(canonical.department ? [{ scopeType: "department", department: { equals: canonical.department, mode: "insensitive" } }] : []), { scopeType: "user", targetUserId: entry.userId }],
    }, select: { id: true },
  });
  return !!lock;
}

export async function listClockifyEntries(db: Db, actor: ClockifyV2Actor, input: { from?: unknown; to?: unknown; cursor?: unknown; limit?: unknown }): Promise<{ entries: unknown[]; groups: ReturnType<typeof groupClockifyEntries>; nextCursor: string | null; page: { limit: number; count: number; total: number } }> {
  const from = asDatePart(input.from), to = asDatePart(input.to);
  const fromDate = romeWallTimeToInstant(from.value, "00:00"), endExclusive = romeWallTimeToInstant(nextDate(to.value), "00:00");
  if (endExclusive.getTime() <= fromDate.getTime() || endExclusive.getTime() - fromDate.getTime() > 93 * 24 * 60 * 60 * 1000) throw new ClockifyEntryError(400, "Report period must be between one and 93 days");
  const canonicalActor = await canonicalizeClockifyActor(actor);
  const scope = getClockifyReportScope(canonicalActor);
  const scopeWhere = scope.kind === "all" ? {} : scope.kind === "department" ? { user: { department: { equals: scope.department, mode: "insensitive" } } } : { userId: scope.userId };
  const where = { deletedAt: null, workDate: { gte: fromDate, lt: endExclusive }, ...scopeWhere };
  const cursor = parseEntryCursor(input.cursor); const limit = parsePageLimit(input.limit);
  const cursorWhere = cursor ? { OR: [{ startAt: { gt: new Date(cursor.startAt) } }, { startAt: new Date(cursor.startAt), id: { gt: cursor.id } }] } : {};
  const rows = await db.clockifyEntry.findMany({ where: { ...where, ...cursorWhere }, orderBy: [{ startAt: "asc" }, { id: "asc" }], take: limit + 1, select: entrySelect });
  const hasMore = rows.length > limit; const entries = hasMore ? rows.slice(0, limit) : rows;
  const effectiveEntries = await Promise.all(entries.map(async (entry: any) => {
    const period = await effectivePeriodLock(db, entry);
    return { ...entry, effectiveLocked: Boolean(entry.lockedAt || entry.lockKind || period), effectiveLockKind: entry.lockKind || (period ? "period" : null) };
  }));
  const pageGroups = groupClockifyEntries(effectiveEntries);
  const aggregate = typeof db.clockifyEntry.aggregate === "function" ? await db.clockifyEntry.aggregate({ where, _sum: { durationMin: true }, _count: { id: true } }) : null;
  const period = aggregate ? { totalMin: aggregate._sum.durationMin || 0, billableMin: 0 } : pageGroups.period;
  if (typeof db.clockifyEntry.aggregate === "function") {
    const billable = await db.clockifyEntry.aggregate({ where: { ...where, billable: true }, _sum: { durationMin: true } });
    period.billableMin = billable._sum.durationMin || 0;
  }
  const last: any = effectiveEntries[effectiveEntries.length - 1];
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ startAt: last.startAt.toISOString(), id: last.id })).toString("base64url") : null;
  return { entries: effectiveEntries, groups: { ...pageGroups, period }, nextCursor, page: { limit, count: effectiveEntries.length, total: aggregate?._count?.id ?? effectiveEntries.length } };
}

export function asClockifyEntryError(error: unknown): ClockifyEntryError | ClockifyCatalogError | null {
  return error instanceof ClockifyEntryError || error instanceof ClockifyCatalogError ? error : null;
}
