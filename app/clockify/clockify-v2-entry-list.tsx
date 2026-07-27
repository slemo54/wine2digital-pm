"use client";

import { CalendarDays, CircleDollarSign, Lock, MoreVertical, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clockifyRomeTime, formatClockifyDay, formatClockifyDuration } from "./clockify-v2-format";
import type { ClockifyV2Entry } from "./clockify-v2-types";

type Day = { date: string; entries: ClockifyV2Entry[]; totalMin: number; billableMin: number };
type Week = { startDate: string; totalMin: number; billableMin: number };
type Props = { days: Day[]; weeks: Week[]; period: { totalMin: number; billableMin: number }; onView: (entry: ClockifyV2Entry) => void };

function weekStart(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function ClockifyV2EntryList({ days, weeks, period, onView }: Props): JSX.Element {
  const weekTotals = new Map(weeks.map((week) => [week.startDate, week]));
  const byWeek = new Map<string, Day[]>();
  for (const day of [...days].sort((left, right) => right.date.localeCompare(left.date))) {
    const key = weekStart(day.date);
    byWeek.set(key, [...(byWeek.get(key) || []), day]);
  }
  const grouped = [...byWeek.entries()].sort(([left], [right]) => right.localeCompare(left));

  return (
    <section aria-labelledby="clockify-timesheet-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="clockify-timesheet-title" className="text-xl font-semibold">Le mie attività</h2>
          <p className="text-sm text-muted-foreground">Modifica, duplica o dividi una registrazione aprendola.</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-2 text-right shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Totale periodo</p>
          <p className="text-xl font-bold tabular-nums">{formatClockifyDuration(period.totalMin)}</p>
        </div>
      </div>
      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <CalendarDays className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
          <p className="font-medium">Nessuna attività nel periodo selezionato.</p>
          <p className="mt-1 text-sm text-muted-foreground">Aggiungi una registrazione manuale dalla barra in alto.</p>
        </div>
      ) : grouped.map(([startDate, weekDays]) => {
        const total = weekTotals.get(startDate) || {
          totalMin: weekDays.reduce((sum, day) => sum + day.totalMin, 0),
          billableMin: weekDays.reduce((sum, day) => sum + day.billableMin, 0),
        };
        return (
          <div key={startDate} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Settimana del {formatClockifyDay(startDate, "short")}</h3>
              <span className="text-sm font-semibold tabular-nums">{formatClockifyDuration(total.totalMin)}</span>
            </div>
            {weekDays.map((day) => (
              <div key={day.date} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex items-center justify-between bg-muted/45 px-4 py-3">
                  <h4 className="font-semibold capitalize">{formatClockifyDay(day.date)}</h4>
                  <span className="text-sm font-semibold tabular-nums">Totale {formatClockifyDuration(day.totalMin)}</span>
                </div>
                <div className="divide-y">
                  {[...day.entries].sort((left, right) => right.startAt.localeCompare(left.startAt)).map((entry) => (
                    <article key={entry.id} className={cn("group grid min-h-[62px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_130px_80px_36px]", entry.effectiveLocked && "bg-muted/20")}>
                      <button type="button" onClick={() => onView(entry)} className="min-w-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`Apri attività ${entry.description}`}>
                        <p className="truncate font-medium">{entry.description}</p>
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.project?.color || "#64748B" }} />
                          <span className="truncate font-medium" style={{ color: entry.project?.color || undefined }}>{entry.project?.name || "Progetto storico"}</span>
                          <span className="truncate text-muted-foreground">· {entry.project?.client || "Senza cliente"}</span>
                          {entry.task && <span className="truncate text-muted-foreground">· {entry.task}</span>}
                          {entry.tags.slice(0, 2).map((tag) => <Badge key={tag} variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] font-normal"><Tags className="h-2.5 w-2.5" />{tag}</Badge>)}
                          {entry.billable && <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-normal"><CircleDollarSign className="h-2.5 w-2.5" />Fatturabile</Badge>}
                          {entry.effectiveLocked && <Badge variant="warning" className="h-5 gap-1 px-1.5 text-[10px] font-normal"><Lock className="h-2.5 w-2.5" />Bloccata</Badge>}
                        </div>
                      </button>
                      <div className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                        {clockifyRomeTime(entry.startAt)} – {clockifyRomeTime(entry.endAt)}
                      </div>
                      <div className="text-right text-base font-bold tabular-nums">{formatClockifyDuration(entry.durationMin)}</div>
                      <Button type="button" variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => onView(entry)} aria-label={`Azioni per ${entry.description}`}><MoreVertical className="h-5 w-5" /></Button>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
