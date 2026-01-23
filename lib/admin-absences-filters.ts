export type AbsenceStatus = "pending" | "approved" | "rejected";

export function parseOptionalInt(input: string | null): number | null {
  if (input === null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function parseOptionalDate(input: string | null): Date | null {
  if (input === null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export type BuildAdminAbsencesWhereInput = {
  q: string;
  statusParam: string;
  typeParam: string;
  from: Date | null;
  to: Date | null;
  createdFrom: Date | null;
  createdTo: Date | null;
};

export function buildAdminAbsencesWhere(input: BuildAdminAbsencesWhereInput): {
  where: unknown;
  countsWhere: unknown;
} {
  const q = input.q.trim();
  const statusParam = input.statusParam.trim();
  const typeParam = input.typeParam.trim();

  const statusFilter: Partial<{ status: AbsenceStatus }> =
    statusParam === "pending" || statusParam === "approved" || statusParam === "rejected"
      ? { status: statusParam as AbsenceStatus }
      : {};

  const typeFilter = typeParam ? { type: typeParam } : {};

  const dateFilter =
    input.from || input.to
      ? {
          // overlap filter: [startDate,endDate] intersects [from,to]
          ...(input.to ? { startDate: { lte: input.to } } : {}),
          ...(input.from ? { endDate: { gte: input.from } } : {}),
        }
      : {};

  const createdAtFilter =
    input.createdFrom || input.createdTo
      ? {
          createdAt: {
            ...(input.createdFrom ? { gte: input.createdFrom } : {}),
            ...(input.createdTo ? { lte: input.createdTo } : {}),
          },
        }
      : {};

  const qFilter = q
    ? {
        OR: [
          { reason: { contains: q, mode: "insensitive" as const } },
          { user: { email: { contains: q, mode: "insensitive" as const } } },
          { user: { name: { contains: q, mode: "insensitive" as const } } },
          { user: { firstName: { contains: q, mode: "insensitive" as const } } },
          { user: { lastName: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const where = {
    AND: [qFilter, statusFilter, typeFilter, dateFilter, createdAtFilter],
  } as const;

  // counts exclude status filter so UI can show distribution in current scope
  const countsWhere = {
    AND: [qFilter, typeFilter, dateFilter, createdAtFilter],
  } as const;

  return { where, countsWhere };
}

export const MAX_BULK_DELETE_IDS = 500;
export const MAX_BULK_DELETE_MATCHES = 2000;

export type BulkDeleteValidation =
  | { ok: true; where: unknown; ids: string[]; before: Date | null; createdFrom: Date | null; createdTo: Date | null }
  | { ok: false; error: string };

export function validateBulkDeleteInput(input: {
  ids?: unknown;
  before?: unknown;
  createdFrom?: unknown;
  createdTo?: unknown;
}): BulkDeleteValidation {
  const idsRaw = Array.isArray(input.ids) ? input.ids : null;
  const ids =
    idsRaw?.map((s) => String(s || "").trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i) ?? [];

  if (ids.length > MAX_BULK_DELETE_IDS) {
    return { ok: false, error: `Too many ids (max ${MAX_BULK_DELETE_IDS})` };
  }

  const before = typeof input.before === "string" ? parseOptionalDate(input.before) : null;
  const createdFrom = typeof input.createdFrom === "string" ? parseOptionalDate(input.createdFrom) : null;
  const createdTo = typeof input.createdTo === "string" ? parseOptionalDate(input.createdTo) : null;

  if (input.before && !before) return { ok: false, error: "Invalid 'before' date" };
  if (input.createdFrom && !createdFrom) return { ok: false, error: "Invalid 'createdFrom' date" };
  if (input.createdTo && !createdTo) return { ok: false, error: "Invalid 'createdTo' date" };

  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    return { ok: false, error: "Invalid createdAt range (from > to)" };
  }

  const where =
    ids.length > 0
      ? ({ id: { in: ids } } as const)
      : before
        ? ({ createdAt: { lt: before } } as const)
        : createdFrom || createdTo
          ? ({
              createdAt: {
                ...(createdFrom ? { gte: createdFrom } : {}),
                ...(createdTo ? { lte: createdTo } : {}),
              },
            } as const)
          : null;

  if (!where) {
    return { ok: false, error: "Provide either ids[] or before or createdFrom/createdTo" };
  }

  return { ok: true, where, ids, before, createdFrom, createdTo };
}

