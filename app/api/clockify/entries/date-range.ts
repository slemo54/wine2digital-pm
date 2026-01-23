function parseIsoDayValue(input: string): { ok: true; date: Date } | { ok: false; error: string } {
  const s = String(input || "").trim();
  if (!s) return { ok: false, error: "Missing date" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: "Invalid date format (expected YYYY-MM-DD)" };
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
  d.setHours(0, 0, 0, 0);
  return { ok: true, date: d };
}

export type ClockifyWorkDateFilter =
  | { kind: "day"; day: Date }
  | { kind: "range"; from: Date; to: Date };

export function parseClockifyWorkDateFilter(input: {
  date?: string | null;
  from?: string | null;
  to?: string | null;
}): { ok: true; filter: ClockifyWorkDateFilter } | { ok: false; error: string } {
  const date = String(input.date || "").trim();
  const from = String(input.from || "").trim();
  const to = String(input.to || "").trim();

  if (from || to) {
    const pFrom = parseIsoDayValue(from);
    if (!pFrom.ok) return pFrom;
    const pTo = parseIsoDayValue(to);
    if (!pTo.ok) return pTo;
    if (pTo.date.getTime() < pFrom.date.getTime()) return { ok: false, error: "Invalid date range" };

    const diffDays = Math.round((pTo.date.getTime() - pFrom.date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 62) return { ok: false, error: "Date range too large" };

    return { ok: true, filter: { kind: "range", from: pFrom.date, to: pTo.date } };
  }

  const pDate = parseIsoDayValue(date);
  if (!pDate.ok) return pDate;
  return { ok: true, filter: { kind: "day", day: pDate.date } };
}

