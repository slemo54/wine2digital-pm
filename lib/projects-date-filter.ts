export type DateRangeInput = {
  startDate: string | null;
  endDate: string | null;
};

export type DateRangeParseResult =
  | { ok: true; start: Date | null; end: Date | null }
  | { ok: false; error: string };

export function parseDateRangeInput(input: DateRangeInput): DateRangeParseResult {
  const startRaw = (input.startDate || "").trim();
  const endRaw = (input.endDate || "").trim();

  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;

  if (start && Number.isNaN(start.getTime())) return { ok: false, error: "Invalid startDate" };
  if (end && Number.isNaN(end.getTime())) return { ok: false, error: "Invalid endDate" };

  if (start && end && start.getTime() > end.getTime()) {
    return { ok: false, error: "startDate must be <= endDate" };
  }

  return { ok: true, start, end };
}

// Overlap logic:
// - start only: include projects whose endDate is null or >= start
// - end only: include projects whose startDate is null or <= end
// - both: include projects overlapping [start,end]
export function buildProjectDateOverlapWhere(parsed: { start: Date | null; end: Date | null }) {
  const { start, end } = parsed;
  if (!start && !end) return {};

  const parts: any[] = [];
  if (end) {
    parts.push({
      OR: [{ startDate: null }, { startDate: { lte: end } }],
    });
  }
  if (start) {
    parts.push({
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    });
  }

  if (parts.length === 1) return parts[0];
  return { AND: parts };
}


