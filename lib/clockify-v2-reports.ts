import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { ClockifyV2Actor } from "./clockify-v2-api";
import { canonicalizeClockifyActor, romeWallTimeToInstant } from "./clockify-v2-entries";
import { getClockifyReportScope } from "./clockify-v2-permissions";

type Db = any;
const ROME = "Europe/Rome";
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
export const CLOCKIFY_REPORT_GROUPS = ["client", "project", "description", "task", "tag", "user"] as const;
export type ClockifyReportGroup = (typeof CLOCKIFY_REPORT_GROUPS)[number];
export type ClockifyReportType = "summary" | "detailed" | "weekly";
export type ClockifyRoundingMode = "nearest" | "up" | "down";
export type ClockifyRounding = { increment: 5 | 10 | 15 | 30 | null; mode: ClockifyRoundingMode | null };

export class ClockifyReportError extends Error {
  constructor(public readonly status: 400 | 403 | 404, message: string) { super(message); }
}

export type ClockifyReportFilters = {
  from: string; to: string; department: string | null; userId: string | null; client: string | null;
  projectId: string | null; taskId: string | null; tag: string | null; locked: boolean | null;
  description: string | null; billable: boolean | null;
};
export type ClockifyDetailedCursor = { kind: "detailed"; startAt: string; id: string };
export type ClockifyWeeklyCursor = { kind: "weekly"; name: string; email: string; id: string };
export type ClockifyReportInput = { reportType: ClockifyReportType; filters: ClockifyReportFilters; groupBy: ClockifyReportGroup | null; rounding: ClockifyRounding; cursor: ClockifyDetailedCursor | ClockifyWeeklyCursor | null; limit: number };

function requiredDay(value: unknown, label: string): string {
  const result = String(value ?? "").trim();
  if (!dayPattern.test(result)) throw new ClockifyReportError(400, `${label} must be YYYY-MM-DD`);
  const [year, month, day] = result.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new ClockifyReportError(400, `${label} is invalid`);
  return result;
}
function nullableText(value: unknown, label: string, max = 200): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const text = String(value).normalize("NFKC").trim();
  if (text.length > max) throw new ClockifyReportError(400, `${label} is too long`);
  return text;
}
function nullableBoolean(value: unknown, label: string): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new ClockifyReportError(400, `${label} must be true or false`);
}
function parseType(value: unknown): ClockifyReportType {
  const type = String(value ?? "summary").trim().toLowerCase();
  if (type === "summary" || type === "detailed" || type === "weekly") return type;
  throw new ClockifyReportError(400, "reportType is invalid");
}
function parseGroup(value: unknown): ClockifyReportGroup | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const group = String(value).trim().toLowerCase();
  if ((CLOCKIFY_REPORT_GROUPS as readonly string[]).includes(group)) return group as ClockifyReportGroup;
  throw new ClockifyReportError(400, "groupBy is invalid");
}
function parseRounding(incrementValue: unknown, modeValue: unknown): ClockifyRounding {
  if (incrementValue === undefined || incrementValue === null || incrementValue === "" || incrementValue === "none") {
    if (modeValue !== undefined && modeValue !== null && String(modeValue).trim() !== "" && String(modeValue).trim() !== "none") throw new ClockifyReportError(400, "roundingMode requires roundingIncrement");
    return { increment: null, mode: null };
  }
  const increment = Number(incrementValue);
  if (![5, 10, 15, 30].includes(increment)) throw new ClockifyReportError(400, "roundingIncrement is invalid");
  const mode = String(modeValue ?? "").trim().toLowerCase();
  if (mode !== "nearest" && mode !== "up" && mode !== "down") throw new ClockifyReportError(400, "roundingMode is invalid");
  return { increment: increment as 5 | 10 | 15 | 30, mode };
}
function parseCursor(value: unknown, reportType: ClockifyReportType): ClockifyDetailedCursor | ClockifyWeeklyCursor | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const id = String(parsed?.id ?? "");
    if (reportType === "weekly") { const name = String(parsed?.name ?? ""), email = String(parsed?.email ?? ""); if (!id) throw new Error("invalid"); return { kind: "weekly", name, email, id }; }
    const startAt = new Date(String(parsed?.startAt ?? ""));
    if (!id || Number.isNaN(startAt.getTime())) throw new Error("invalid");
    return { kind: "detailed", startAt: startAt.toISOString(), id };
  } catch { throw new ClockifyReportError(400, "cursor is invalid"); }
}
function parseLimit(value: unknown): number {
  if (value === undefined || value === null || String(value).trim() === "") return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new ClockifyReportError(400, "limit must be an integer between 1 and 500");
  return limit;
}

/** Parses HTTP params and share payloads identically, so exported/shared data cannot diverge. */
export function normalizeClockifyReportInput(input: Record<string, unknown> & { reportType?: unknown }): ClockifyReportInput {
  const from = requiredDay(input.from, "from"), to = requiredDay(input.to, "to");
  if (to < from) throw new ClockifyReportError(400, "Invalid date range");
  const fromInstant = romeWallTimeToInstant(from, "00:00"), toInstant = romeWallTimeToInstant(to, "00:00");
  if (toInstant.getTime() - fromInstant.getTime() > 366 * 24 * 60 * 60 * 1000) throw new ClockifyReportError(400, "Report period must not exceed 366 days");
  const reportType = parseType(input.reportType);
  return {
    reportType,
    filters: { from, to, department: nullableText(input.department, "department"), userId: nullableText(input.userId, "userId"), client: nullableText(input.client, "client"), projectId: nullableText(input.projectId, "projectId"), taskId: nullableText(input.taskId, "taskId"), tag: nullableText(input.tag, "tag"), locked: nullableBoolean(input.locked, "locked"), description: nullableText(input.description, "description", 500), billable: nullableBoolean(input.billable, "billable") },
    groupBy: parseGroup(input.groupBy), rounding: parseRounding(input.roundingIncrement, input.roundingMode), cursor: parseCursor(input.cursor, reportType), limit: parseLimit(input.limit),
  };
}

export function roundClockifyMinutes(minutes: number, rounding: ClockifyRounding): number {
  if (!rounding.increment || !rounding.mode) return minutes;
  if (rounding.mode === "up") return Math.ceil(minutes / rounding.increment) * rounding.increment;
  if (rounding.mode === "down") return Math.floor(minutes / rounding.increment) * rounding.increment;
  return Math.floor((minutes + rounding.increment / 2) / rounding.increment) * rounding.increment;
}
/** Tag reports allocate an entry's already-rounded duration equally across distinct normalized tags; untagged entries have one stable bucket. */
export function allocateClockifyTagMinutes(minutes: number, tags: unknown[], rounding: ClockifyRounding): Array<{ label: string; totalMin: number }> {
  const labels = [...new Set(tags.map((tag) => String(tag ?? "").normalize("NFKC").trim()).filter(Boolean))];
  const totalMin = roundClockifyMinutes(minutes, rounding); const buckets = labels.length ? labels : ["Senza tag"];
  return buckets.map((label) => ({ label, totalMin: totalMin / buckets.length }));
}
function endExclusive(day: string): Date {
  const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1);
  return romeWallTimeToInstant(value.toISOString().slice(0, 10), "00:00");
}
function number(value: unknown): number { return Number(value ?? 0); }
function groupExpression(group: ClockifyReportGroup): Prisma.Sql {
  // These are closed, static fragments. User input is never an SQL identifier.
  switch (group) {
    case "client": return Prisma.sql`COALESCE(p."client", '')`;
    case "project": return Prisma.sql`p."name"`;
    case "description": return Prisma.sql`e."description"`;
    case "task": return Prisma.sql`COALESCE(t."name", e."task", '')`;
    case "tag": return Prisma.sql`COALESCE(report_tag.value, '')`;
    case "user": return Prisma.sql`COALESCE(u."name", u."email")`;
  }
}
function roundedExpression(rounding: ClockifyRounding): Prisma.Sql {
  if (!rounding.increment || !rounding.mode) return Prisma.sql`e."durationMin"`;
  const increment = rounding.increment;
  if (rounding.mode === "up") return Prisma.sql`(CEIL(e."durationMin"::numeric / ${increment}) * ${increment})::int`;
  if (rounding.mode === "down") return Prisma.sql`(FLOOR(e."durationMin"::numeric / ${increment}) * ${increment})::int`;
  return Prisma.sql`(FLOOR((e."durationMin" + ${increment} / 2)::numeric / ${increment}) * ${increment})::int`;
}
function tagAllocationExpression(rounding: ClockifyRounding): Prisma.Sql {
  const duration = roundedExpression(rounding);
  return Prisma.sql`(${duration})::numeric / GREATEST((SELECT COUNT(DISTINCT btrim(tag_value)) FROM unnest(e."tags") tag_value WHERE btrim(tag_value) <> ''), 1)`;
}
function activeLockExpression(): Prisma.Sql {
  return Prisma.sql`(e."lockedAt" IS NOT NULL OR e."lockKind" IS NOT NULL OR EXISTS (
    SELECT 1 FROM "ClockifyLockPeriod" lock_period
    WHERE lock_period."unlockedAt" IS NULL AND lock_period."startDate" <= e."workDate" AND lock_period."endDate" >= e."workDate"
      AND (lock_period."scopeType" = 'all' OR (lock_period."scopeType" = 'user' AND lock_period."targetUserId" = e."userId")
        OR (lock_period."scopeType" = 'department' AND u."department" IS NOT NULL AND lower(btrim(lock_period."department")) = lower(btrim(u."department"))))
  ))`;
}
export async function buildClockifyReportWhere(actor: ClockifyV2Actor, filters: ClockifyReportFilters, normalizer?: (department: unknown) => Promise<string | null>): Promise<Prisma.Sql> {
  const canonical = await canonicalizeClockifyActor(actor, normalizer);
  const scope = getClockifyReportScope(canonical);
  const conditions: Prisma.Sql[] = [Prisma.sql`e."deletedAt" IS NULL`, Prisma.sql`e."workDate" >= ${romeWallTimeToInstant(filters.from, "00:00")}`, Prisma.sql`e."workDate" < ${endExclusive(filters.to)}`];
  if (scope.kind === "self") conditions.push(Prisma.sql`e."userId" = ${scope.userId}`);
  if (scope.kind === "department") conditions.push(Prisma.sql`lower(btrim(u."department")) = lower(btrim(${scope.department}))`);
  if (filters.department) conditions.push(Prisma.sql`lower(btrim(u."department")) = lower(btrim(${filters.department}))`);
  if (filters.userId) conditions.push(Prisma.sql`e."userId" = ${filters.userId}`);
  if (filters.client) conditions.push(Prisma.sql`p."client" = ${filters.client}`);
  if (filters.projectId) conditions.push(Prisma.sql`e."projectId" = ${filters.projectId}`);
  if (filters.taskId) conditions.push(Prisma.sql`e."taskId" = ${filters.taskId}`);
  if (filters.tag) conditions.push(Prisma.sql`e."tags" @> ARRAY[${filters.tag}]::text[]`);
  if (filters.description) conditions.push(Prisma.sql`e."description" ILIKE '%' || ${filters.description} || '%'`);
  if (filters.billable !== null) conditions.push(Prisma.sql`e."billable" = ${filters.billable}`);
  if (filters.locked !== null) conditions.push(filters.locked ? activeLockExpression() : Prisma.sql`NOT ${activeLockExpression()}`);
  return Prisma.join(conditions, " AND ");
}
function reportFrom(includeTags = false): Prisma.Sql {
  return includeTags
    ? Prisma.sql`FROM "ClockifyEntry" e JOIN "User" u ON u.id = e."userId" JOIN "ClockifyProject" p ON p.id = e."projectId" LEFT JOIN "ClockifyTask" t ON t.id = e."taskId" LEFT JOIN LATERAL (SELECT DISTINCT btrim(tag_value) AS value FROM unnest(e."tags") tag_value WHERE btrim(tag_value) <> '') report_tag ON TRUE`
    : Prisma.sql`FROM "ClockifyEntry" e JOIN "User" u ON u.id = e."userId" JOIN "ClockifyProject" p ON p.id = e."projectId" LEFT JOIN "ClockifyTask" t ON t.id = e."taskId"`;
}

export async function getClockifySummaryReport(db: Db, actor: ClockifyV2Actor, input: ClockifyReportInput): Promise<unknown> {
  const where = await buildClockifyReportWhere(actor, input.filters), duration = roundedExpression(input.rounding), includeTags = input.groupBy === "tag";
  // Tag expansion belongs only to the tag distribution. Applying it to totals would count a multi-tag entry more than once.
  const from = reportFrom(false), groupFrom = reportFrom(includeTags);
  const [totalRows, seriesRows, groups] = await Promise.all([
    db.$queryRaw(Prisma.sql`SELECT COUNT(DISTINCT e.id)::int AS "entryCount", COALESCE(SUM(${duration}), 0)::bigint AS "totalMin", COALESCE(SUM(CASE WHEN e."billable" THEN ${duration} ELSE 0 END), 0)::bigint AS "billableMin" ${from} WHERE ${where}`),
    db.$queryRaw(Prisma.sql`SELECT (e."workDate" AT TIME ZONE ${ROME})::date::text AS date, COALESCE(SUM(${duration}), 0)::bigint AS "totalMin" ${from} WHERE ${where} GROUP BY 1 ORDER BY 1`),
    input.groupBy ? db.$queryRaw(Prisma.sql`
      WITH grouped AS (SELECT ${groupExpression(input.groupBy)} AS label, COALESCE(SUM(${input.groupBy === "tag" ? tagAllocationExpression(input.rounding) : duration}), 0)::numeric AS "totalMin" ${groupFrom} WHERE ${where} GROUP BY 1),
      ranked AS (SELECT label, "totalMin", row_number() OVER (ORDER BY "totalMin" DESC, label ASC) AS position FROM grouped)
      SELECT CASE WHEN position <= 50 THEN label ELSE 'Altro' END AS label, SUM("totalMin") AS "totalMin", MIN(position) AS position
      FROM ranked GROUP BY CASE WHEN position <= 50 THEN label ELSE 'Altro' END ORDER BY position`) : Promise.resolve([]),
  ]);
  const total = totalRows[0] || {};
  const totalMin = number(total.totalMin), billableMin = number(total.billableMin);
  return { type: "summary", totalMin, totalHours: totalMin / 60, billableMin, billableHours: billableMin / 60, entryCount: number(total.entryCount), timeSeries: seriesRows.map((row: any) => ({ date: row.date, totalMin: number(row.totalMin), totalHours: number(row.totalMin) / 60 })), bar: groups.map((row: any) => ({ label: row.label || "—", totalMin: number(row.totalMin), totalHours: number(row.totalMin) / 60 })), distribution: groups.map((row: any) => ({ label: row.label || "—", totalMin: number(row.totalMin) })) };
}

export async function getClockifyDetailedReport(db: Db, actor: ClockifyV2Actor, input: ClockifyReportInput): Promise<unknown> {
  const where = await buildClockifyReportWhere(actor, input.filters), duration = roundedExpression(input.rounding);
  const detailedCursor = input.cursor?.kind === "detailed" ? input.cursor : null;
  const cursor = detailedCursor ? Prisma.sql`AND (e."startAt" > ${new Date(detailedCursor.startAt)} OR (e."startAt" = ${new Date(detailedCursor.startAt)} AND e.id > ${detailedCursor.id}))` : Prisma.empty;
  const rows = await db.$queryRaw(Prisma.sql`SELECT e.id, e."workDate", e."startAt", e."endAt", e."description", e."task", e."tags", e."billable", e."durationMin" AS "storedDurationMin", ${duration} AS "durationMin", ${activeLockExpression()} AS "effectiveLocked", e."userId", u."name" AS "userName", u.email AS "userEmail", u.department, e."projectId", p.name AS "projectName", p.client, e."taskId" ${reportFrom()} WHERE ${where} ${cursor} ORDER BY e."startAt" ASC, e.id ASC LIMIT ${input.limit + 1}`);
  const totals = await db.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(${duration}), 0)::bigint AS "totalMin" ${reportFrom()} WHERE ${where}`);
  const hasMore = rows.length > input.limit, page = hasMore ? rows.slice(0, input.limit) : rows;
  const last: any = page[page.length - 1];
  return { type: "detailed", rows: page.map((row: any) => ({ ...row, durationMin: number(row.durationMin), storedDurationMin: number(row.storedDurationMin), effectiveLocked: Boolean(row.effectiveLocked) })), total: { count: number(totals[0]?.count), totalMin: number(totals[0]?.totalMin) }, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ startAt: new Date(last.startAt).toISOString(), id: last.id })).toString("base64url") : null };
}

export async function getClockifyWeeklyReport(db: Db, actor: ClockifyV2Actor, input: ClockifyReportInput): Promise<unknown> {
  const where = await buildClockifyReportWhere(actor, input.filters), duration = roundedExpression(input.rounding);
  const weeklyCursor = input.cursor?.kind === "weekly" ? input.cursor : null;
  const cursorClause = weeklyCursor ? Prisma.sql`WHERE (COALESCE("userName", "userEmail") > ${weeklyCursor.name} OR (COALESCE("userName", "userEmail") = ${weeklyCursor.name} AND "userEmail" > ${weeklyCursor.email}) OR (COALESCE("userName", "userEmail") = ${weeklyCursor.name} AND "userEmail" = ${weeklyCursor.email} AND "userId" > ${weeklyCursor.id}))` : Prisma.empty;
  const rows = await db.$queryRaw(Prisma.sql`
    WITH filtered AS (SELECT e.*, u."name" AS "userName", u.email AS "userEmail" ${reportFrom()} WHERE ${where}),
    people AS (SELECT DISTINCT "userId", "userName", "userEmail" FROM filtered),
    page_people AS (SELECT * FROM people ${cursorClause} ORDER BY COALESCE("userName", "userEmail"), "userEmail", "userId" LIMIT ${input.limit + 1}),
    days AS (SELECT generate_series(${input.filters.from}::date, ${input.filters.to}::date, interval '1 day')::date AS day),
    person_day_totals AS (SELECT e."userId", (e."workDate" AT TIME ZONE ${ROME})::date AS day, SUM(${duration})::numeric AS "totalMin" FROM filtered e GROUP BY 1, 2),
    all_day_totals AS (SELECT day, SUM("totalMin")::numeric AS "totalMin" FROM person_day_totals GROUP BY day)
    SELECT page_people."userId", page_people."userName", page_people."userEmail", days.day::text AS date, COALESCE(person_day_totals."totalMin", 0)::numeric AS "totalMin", COALESCE(all_day_totals."totalMin", 0)::numeric AS "globalDayTotal"
    FROM page_people CROSS JOIN days LEFT JOIN person_day_totals ON person_day_totals."userId" = page_people."userId" AND person_day_totals.day = days.day LEFT JOIN all_day_totals ON all_day_totals.day = days.day
    ORDER BY COALESCE(page_people."userName", page_people."userEmail"), page_people."userEmail", page_people."userId", days.day`);
  const days = dateRange(input.filters.from, input.filters.to);
  const byUser = new Map<string, any>();
  const globalByDay = new Map<string, number>();
  for (const row of rows as any[]) { const person = byUser.get(row.userId) || { userId: row.userId, name: row.userName || row.userEmail, email: row.userEmail, days: [], totalMin: 0 }; const totalMin = number(row.totalMin); person.days.push({ date: row.date, totalMin }); person.totalMin += totalMin; byUser.set(row.userId, person); globalByDay.set(row.date, number(row.globalDayTotal)); }
  const allPeople = [...byUser.values()]; const hasMore = allPeople.length > input.limit; const people = hasMore ? allPeople.slice(0, input.limit) : allPeople;
  const last = people[people.length - 1]; const dayTotals = days.map((date) => ({ date, totalMin: globalByDay.get(date) || 0 }));
  return { type: "weekly", days, people, dayTotals, grandTotalMin: dayTotals.reduce((sum, day) => sum + day.totalMin, 0), nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ name: last.name, email: last.email, id: last.userId })).toString("base64url") : null };
}
function dateRange(from: string, to: string): string[] { const values: string[] = []; for (let date = new Date(`${from}T12:00:00Z`), end = new Date(`${to}T12:00:00Z`); date <= end; date.setUTCDate(date.getUTCDate() + 1)) values.push(date.toISOString().slice(0, 10)); return values; }

export async function runClockifyReport(db: Db, actor: ClockifyV2Actor, input: ClockifyReportInput): Promise<unknown> {
  if (input.reportType === "summary") return getClockifySummaryReport(db, actor, input);
  if (input.reportType === "detailed") return getClockifyDetailedReport(db, actor, input);
  return getClockifyWeeklyReport(db, actor, input);
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function clockifyReportCsv(report: any): string {
  if (report.type === "detailed") return [["Date", "Start", "End", "User", "Client", "Project", "Task", "Description", "Tags", "Billable", "Minutes"], ...report.rows.map((row: any) => [row.workDate, row.startAt, row.endAt, row.userName || row.userEmail, row.client, row.projectName, row.task, row.description, (row.tags || []).join(" | "), row.billable ? "yes" : "no", row.durationMin])].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
  if (report.type === "weekly") return [["User", ...report.days, "Total"], ...report.people.map((person: any) => [person.name, ...report.days.map((date: string) => person.days.find((day: any) => day.date === date)?.totalMin || 0), person.totalMin]), ["Total", ...report.dayTotals.map((day: any) => day.totalMin), report.grandTotalMin]].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return [["Date", "Minutes"], ...report.timeSeries.map((row: any) => [row.date, row.totalMin]), [], ["Total", report.totalMin], ...(report.bar || []).map((row: any) => [row.label, row.totalMin])].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function createClockifyDetailedCsvStream(loadPage: (cursor: string | null) => Promise<any>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({ async start(controller): Promise<void> { try { let cursor: string | null = null; let header = true; do { const page = await loadPage(cursor); const csv = clockifyReportCsv(page); controller.enqueue(encoder.encode(header ? csv : csv.slice(csv.indexOf("\r\n") + 2))); header = false; cursor = page.nextCursor; } while (cursor); controller.close(); } catch (error) { controller.error(error); } } });
}

/** Detailed exports fetch one bounded cursor page at a time and enqueue it immediately: no all-report string or row array is retained. */
export function exportClockifyReportCsv(db: Db, actor: ClockifyV2Actor, input: ClockifyReportInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller): Promise<void> {
      try {
        if (input.reportType === "summary") { controller.enqueue(encoder.encode(clockifyReportCsv(await runClockifyReport(db, actor, input)))); controller.close(); return; }
        if (input.reportType === "weekly") {
          let cursor: string | null = null; let header = true; let totals: any = null;
          do { const page: any = await getClockifyWeeklyReport(db, actor, { ...input, limit: 500, cursor: cursor ? parseCursor(cursor, "weekly") : null }); totals ||= page; const lines = [header ? ["User", ...page.days, "Total"] : null, ...page.people.map((person: any) => [person.name, ...page.days.map((date: string) => person.days.find((day: any) => day.date === date)?.totalMin || 0), person.totalMin])].filter(Boolean).map((line: any) => line.map(csvCell).join(",")).join("\r\n"); controller.enqueue(encoder.encode(lines + (lines ? "\r\n" : ""))); header = false; cursor = page.nextCursor; } while (cursor);
          if (totals) controller.enqueue(encoder.encode(["Total", ...totals.dayTotals.map((day: any) => day.totalMin), totals.grandTotalMin].map(csvCell).join(",") + "\r\n"));
          controller.close(); return;
        }
        const reader = createClockifyDetailedCsvStream(async (cursor) => getClockifyDetailedReport(db, actor, { ...input, limit: 500, cursor: cursor ? parseCursor(cursor, "detailed") : null })).getReader();
        while (true) { const next = await reader.read(); if (next.done) break; controller.enqueue(next.value); }
        controller.close();
      } catch (error) { controller.error(error); }
    },
  });
}

export function hashClockifyShareToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function validateClockifyShareToken(token: unknown): string { const value = String(token ?? ""); if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new ClockifyReportError(404, "Share not found"); return value; }
function hashesEqual(left: string, right: string): boolean { const a = Buffer.from(left, "hex"), b = Buffer.from(right, "hex"); return a.length === b.length && timingSafeEqual(a, b); }

export async function createClockifyReportShare(db: Db, actor: ClockifyV2Actor, input: Record<string, unknown>): Promise<{ id: string; token: string; reportType: ClockifyReportType; createdAt: Date }> {
  const report = normalizeClockifyReportInput(input);
  const token = randomBytes(32).toString("base64url"), tokenHash = hashClockifyShareToken(token);
  const created = await db.$transaction(async (tx: Db) => {
    const share = await tx.clockifyReportShare.create({ data: { tokenHash, reportType: report.reportType, filters: report.filters, groupBy: report.groupBy, roundingIncrement: report.rounding.increment, roundingMode: report.rounding.mode, createdById: actor.userId } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.report_share.create", entityType: "ClockifyReportShare", entityId: share.id, metadata: { reportType: report.reportType, groupBy: report.groupBy } } });
    return share;
  });
  return { id: created.id, token, reportType: report.reportType, createdAt: created.createdAt };
}
export async function listClockifyReportShares(db: Db, actor: ClockifyV2Actor): Promise<unknown[]> { return db.clockifyReportShare.findMany({ where: { createdById: actor.userId }, orderBy: { createdAt: "desc" }, select: { id: true, reportType: true, filters: true, groupBy: true, roundingIncrement: true, roundingMode: true, createdAt: true, revokedAt: true } }); }
export async function revokeClockifyReportShare(db: Db, actor: ClockifyV2Actor, id: string): Promise<void> {
  await db.$transaction(async (tx: Db) => { const share = await tx.clockifyReportShare.findFirst({ where: { id, createdById: actor.userId, revokedAt: null }, select: { id: true } }); if (!share) throw new ClockifyReportError(404, "Share not found"); await tx.clockifyReportShare.update({ where: { id }, data: { revokedAt: new Date(), revokedById: actor.userId } }); await tx.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.report_share.revoke", entityType: "ClockifyReportShare", entityId: id, metadata: {} } }); });
}
export async function getClockifyPublicShare(db: Db, rawToken: unknown, paging: { cursor?: unknown; limit?: unknown } = {}): Promise<{ share: unknown; report: unknown }> {
  const token = validateClockifyShareToken(rawToken), tokenHash = hashClockifyShareToken(token);
  const share = await db.clockifyReportShare.findUnique({ where: { tokenHash }, include: { createdBy: { select: { id: true, role: true, department: true, isActive: true } } } });
  if (!share || share.revokedAt || !share.createdBy?.isActive || !hashesEqual(tokenHash, share.tokenHash)) throw new ClockifyReportError(404, "Share not found");
  const actor: ClockifyV2Actor = { userId: share.createdBy.id, role: share.createdBy.role === "admin" || share.createdBy.role === "manager" ? share.createdBy.role : "member", department: share.createdBy.department };
  // Only opaque page controls are accepted from the public request; filters/type remain share-owned.
  const input = normalizeClockifyReportInput({ reportType: share.reportType, ...(share.filters as Record<string, unknown>), groupBy: share.groupBy, roundingIncrement: share.roundingIncrement, roundingMode: share.roundingMode, cursor: paging.cursor, limit: paging.limit });
  return { share: { id: share.id, reportType: share.reportType, groupBy: share.groupBy, createdAt: share.createdAt }, report: await runClockifyReport(db, actor, input) };
}
