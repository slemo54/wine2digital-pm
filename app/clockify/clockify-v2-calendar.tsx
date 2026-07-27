"use client";

import { useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { layoutClockifyDaySegments, segmentClockifyEntriesByRomeDay } from "./clockify-v2-calendar-layout";
import { clockifyRomeDate, formatClockifyDay, formatClockifyDuration, formatClockifyPeriod } from "./clockify-v2-format";
import type { ClockifyV2Entry } from "./clockify-v2-types";

type View = "day" | "week" | "month";
function addDays(value: Date, days: number): Date { const copy = new Date(value); copy.setUTCDate(copy.getUTCDate() + days); return copy; }
export type ClockifyCalendarView = View;
export function getClockifyCalendarRange(view: View, anchor: Date): { from: string; to: string } {
  const local = clockifyRomeDate(anchor);
  const date = new Date(`${local}T12:00:00Z`);
  if (view === "day") return { from: local, to: local };
  if (view === "month") {
    const from = `${local.slice(0, 7)}-01`;
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return { from, to: end.toISOString().slice(0, 10) };
  }
  const monday = addDays(date, -((date.getUTCDay() + 6) % 7));
  return { from: monday.toISOString().slice(0, 10), to: addDays(monday, 6).toISOString().slice(0, 10) };
}
export function stepClockifyCalendarAnchor(view: View, anchor: Date, direction: -1 | 1): Date {
  if (view !== "month") return addDays(anchor, direction * (view === "week" ? 7 : 1));
  const local = clockifyRomeDate(anchor);
  const date = new Date(`${local}T12:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1, 12));
}

function dateValues(range: { from: string; to: string }): string[] {
  const start = new Date(`${range.from}T12:00:00Z`);
  const end = new Date(`${range.to}T12:00:00Z`);
  return Array.from({ length: Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 }, (_, index) => addDays(start, index).toISOString().slice(0, 10));
}

export function ClockifyV2Calendar({
  entries,
  onView,
  view,
  anchor,
  onViewChange,
  onAnchorChange,
}: {
  entries: ClockifyV2Entry[];
  onView: (entry: ClockifyV2Entry) => void;
  view: View;
  anchor: Date;
  onViewChange: (view: View) => void;
  onAnchorChange: (anchor: Date) => void;
}): JSX.Element {
  const range = useMemo(() => getClockifyCalendarRange(view, anchor), [anchor, view]);
  const dates = useMemo(() => dateValues(range), [range]);
  const segments = useMemo(() => segmentClockifyEntriesByRomeDay(entries), [entries]);
  const totalByDate = useMemo(() => {
    const totals = new Map<string, number>();
    for (const segment of segments) {
      totals.set(segment.date, (totals.get(segment.date) || 0) + segment.endMinute - segment.startMinute);
    }
    return totals;
  }, [segments]);

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm" aria-label="Calendario rendicontazione">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border bg-muted/20 p-1" role="group" aria-label="Vista calendario">
          {(["week", "day", "month"] as View[]).map((item) => (
            <Button key={item} size="sm" variant={view === item ? "secondary" : "ghost"} onClick={() => onViewChange(item)} aria-pressed={view === item}>
              {item === "day" ? "Giorno" : item === "week" ? "Settimana" : "Mese"}
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-1">
          <Button size="icon" variant="outline" aria-label="Periodo precedente" onClick={() => onAnchorChange(stepClockifyCalendarAnchor(view, anchor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" className="min-w-[190px] justify-center" onClick={() => onAnchorChange(new Date())}>
            <CalendarDays className="mr-2 h-4 w-4" />{formatClockifyPeriod(range.from, range.to)}
          </Button>
          <Button size="icon" variant="outline" aria-label="Periodo successivo" onClick={() => onAnchorChange(stepClockifyCalendarAnchor(view, anchor, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {view === "month"
        ? <MonthGrid dates={dates} segments={segments} totalByDate={totalByDate} onView={onView} />
        : <TimeGrid dates={dates} segments={segments} totalByDate={totalByDate} onView={onView} view={view} />}
    </section>
  );
}

function TimeGrid({
  dates,
  segments,
  totalByDate,
  onView,
  view,
}: {
  dates: string[];
  segments: ReturnType<typeof segmentClockifyEntriesByRomeDay<ClockifyV2Entry>>;
  totalByDate: Map<string, number>;
  onView: (entry: ClockifyV2Entry) => void;
  view: "day" | "week";
}): JSX.Element {
  const visible = segments.filter((segment) => dates.includes(segment.date));
  const startHour = Math.max(0, Math.min(7, Math.floor(Math.min(...visible.map((segment) => segment.startMinute), 7 * 60) / 60)));
  const endHour = Math.min(24, Math.max(19, Math.ceil(Math.max(...visible.map((segment) => segment.endMinute), 19 * 60) / 60)));
  const hourHeight = 64;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const contentHeight = (endHour - startHour) * hourHeight;
  const laidOut = new Map(dates.map((date) => [date, layoutClockifyDaySegments(visible.filter((segment) => segment.date === date))]));
  return (
    <div className="overflow-x-auto">
      <div className={cn("min-w-[720px]", view === "week" ? "lg:min-w-[960px]" : "min-w-0")}>
        <div className="grid border-b bg-muted/25" style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(${view === "day" ? "260px" : "128px"}, 1fr))` }}>
          <div className="border-r" />
          {dates.map((date) => (
            <div key={date} className="border-r px-2 py-3 text-center last:border-r-0">
              <p className="text-sm font-semibold capitalize">{formatClockifyDay(date, "short")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatClockifyDuration(totalByDate.get(date) || 0)}</p>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(${view === "day" ? "260px" : "128px"}, 1fr))` }}>
          <div className="relative border-r bg-muted/10" style={{ height: contentHeight }}>
            {hours.slice(0, -1).map((hour) => <span key={hour} className="absolute right-2 -translate-y-2 text-xs tabular-nums text-muted-foreground" style={{ top: (hour - startHour) * hourHeight }}>{String(hour).padStart(2, "0")}:00</span>)}
          </div>
          {dates.map((date) => (
            <div key={date} className="relative border-r last:border-r-0" style={{ height: contentHeight }}>
              {hours.slice(0, -1).map((hour) => <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: (hour - startHour) * hourHeight }} />)}
              {(laidOut.get(date) || []).map((segment) => {
                const entry = segment.source;
                const top = ((segment.startMinute - startHour * 60) / 60) * hourHeight;
                const height = Math.max(26, ((segment.endMinute - segment.startMinute) / 60) * hourHeight);
                const gap = 3;
                const width = `calc(${100 / segment.columnCount}% - ${gap}px)`;
                const left = `calc(${(100 / segment.columnCount) * segment.column}% + ${gap / 2}px)`;
                const color = entry.project?.color || "#64748B";
                return (
                  <button
                    key={`${segment.entryId}-${segment.startMinute}`}
                    type="button"
                    onClick={() => onView(entry)}
                    className="absolute z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm transition hover:z-20 hover:brightness-95 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ top, height, width, left, borderLeftColor: color, backgroundColor: `${color}22` }}
                    aria-label={`Apri ${entry.description}`}
                  >
                    <span className="block truncate font-semibold">{entry.description}</span>
                    <span className="mt-0.5 block truncate" style={{ color }}>{entry.project?.name || "Progetto storico"}</span>
                    {height >= 52 && <span className="mt-1 block font-medium tabular-nums">{formatClockifyDuration(Math.round(segment.endMinute - segment.startMinute))}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  dates,
  segments,
  totalByDate,
  onView,
}: {
  dates: string[];
  segments: ReturnType<typeof segmentClockifyEntriesByRomeDay<ClockifyV2Entry>>;
  totalByDate: Map<string, number>;
  onView: (entry: ClockifyV2Entry) => void;
}): JSX.Element {
  const first = new Date(`${dates[0]}T12:00:00Z`);
  const leading = (first.getUTCDay() + 6) % 7;
  const byDate = new Map(dates.map((date) => [
    date,
    segments
      .filter((segment) => segment.date === date)
      .sort((left, right) => left.startMinute - right.startMinute || left.entryId.localeCompare(right.entryId))
      .map((segment) => segment.source),
  ]));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b bg-muted/25 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((label) => <div key={label} className="border-r px-2 py-2 last:border-r-0">{label}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: leading }, (_, index) => <div key={`empty-${index}`} className="min-h-[128px] border-b border-r bg-muted/10" />)}
          {dates.map((date) => (
            <div key={date} className="min-h-[128px] border-b border-r p-2 last:border-r-0">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{Number(date.slice(-2))}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatClockifyDuration(totalByDate.get(date) || 0)}</span>
              </div>
              <div className="space-y-1">
                {(byDate.get(date) || []).slice(0, 4).map((entry) => (
                  <button key={entry.id} type="button" className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onView(entry)}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.project?.color || "#64748B" }} />
                    <span className="truncate">{entry.description}</span>
                  </button>
                ))}
                {(byDate.get(date) || []).length > 4 && <p className="px-1 text-xs text-muted-foreground">+{(byDate.get(date) || []).length - 4} altre</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
