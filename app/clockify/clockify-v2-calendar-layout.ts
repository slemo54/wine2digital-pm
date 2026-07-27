const ROME = "Europe/Rome";

export type ClockifyCalendarSource = { id: string; startAt?: string; endAt?: string };
export type ClockifyCalendarSegment<T = ClockifyCalendarSource> = {
  entryId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  source: T;
};
export type ClockifyCalendarLayoutSegment<T = ClockifyCalendarSource> = ClockifyCalendarSegment<T> & {
  column: number;
  columnCount: number;
};

function parts(value: Date): { date: string; minute: number } {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => values.find((part) => part.type === type)?.value || "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function nextDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function romeMidnight(value: string): Date {
  const center = new Date(`${value}T00:00:00Z`).getTime();
  for (let offset = -240; offset <= 240; offset += 1) {
    const candidate = new Date(center + offset * 60_000);
    const local = parts(candidate);
    if (local.date === value && local.minute === 0) return candidate;
  }
  throw new Error(`Impossibile risolvere la mezzanotte Europe/Rome per ${value}`);
}

export function segmentClockifyEntriesByRomeDay<T extends ClockifyCalendarSource>(entries: T[]): Array<ClockifyCalendarSegment<T>> {
  const result: Array<ClockifyCalendarSegment<T>> = [];
  for (const source of entries) {
    const start = new Date(String(source.startAt));
    const end = new Date(String(source.endAt));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    let segmentStart = start;
    while (segmentStart < end) {
      const localStart = parts(segmentStart);
      const boundary = romeMidnight(nextDate(localStart.date));
      const segmentEnd = end < boundary ? end : boundary;
      const localEnd = parts(segmentEnd);
      result.push({
        entryId: source.id,
        date: localStart.date,
        startMinute: localStart.minute,
        endMinute: segmentEnd.getTime() === boundary.getTime() ? 1440 : localEnd.minute,
        source,
      });
      segmentStart = segmentEnd;
    }
  }
  return result;
}

export function layoutClockifyDaySegments<T>(segments: Array<ClockifyCalendarSegment<T>>): Array<ClockifyCalendarLayoutSegment<T>> {
  const sorted = [...segments].sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute || left.entryId.localeCompare(right.entryId));
  const output: Array<ClockifyCalendarLayoutSegment<T>> = [];
  let index = 0;
  while (index < sorted.length) {
    const cluster: Array<ClockifyCalendarLayoutSegment<T>> = [];
    let clusterEnd = sorted[index].endMinute;
    while (index < sorted.length && (cluster.length === 0 || sorted[index].startMinute < clusterEnd)) {
      const segment = sorted[index];
      const used = new Set(cluster.filter((item) => item.endMinute > segment.startMinute).map((item) => item.column));
      let column = 0;
      while (used.has(column)) column += 1;
      cluster.push({ ...segment, column, columnCount: 1 });
      clusterEnd = Math.max(clusterEnd, segment.endMinute);
      index += 1;
    }
    const columnCount = Math.max(1, ...cluster.map((item) => item.column + 1));
    output.push(...cluster.map((item) => ({ ...item, columnCount })));
  }
  return output;
}
