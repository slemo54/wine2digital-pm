"use client";

import { Copy, Pencil, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClockifyV2Entry } from "./clockify-v2-types";

type Day = { date: string; entries: ClockifyV2Entry[]; totalMin: number; billableMin: number };
type Week = { startDate: string; totalMin: number; billableMin: number };
type Props = { days: Day[]; weeks: Week[]; period: { totalMin: number; billableMin: number }; meId: string; onEdit: (entry: ClockifyV2Entry) => void; onDuplicate: (entry: ClockifyV2Entry) => void; onSplit: (entry: ClockifyV2Entry) => void; onDelete: (entry: ClockifyV2Entry) => void };

function minutes(value: number): string { return `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, "0")}m`; }
function time(value: string): string { return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)); }

export function ClockifyV2EntryList({ days, weeks, period, meId, onEdit, onDuplicate, onSplit, onDelete }: Props): JSX.Element {
  return <div className="space-y-4"><Card><CardHeader><CardTitle>Totale periodo: {minutes(period.totalMin)} <span className="text-sm font-normal text-muted-foreground">· fatturabile {minutes(period.billableMin)}</span></CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground">{weeks.map((week) => <span key={week.startDate}>Settimana del {week.startDate}: {minutes(week.totalMin)}</span>)}</CardContent></Card>
    {days.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nessuna attività nel periodo selezionato.</CardContent></Card> : days.map((day) => <Card key={day.date}><CardHeader><CardTitle className="text-base">{day.date} <span className="font-normal text-muted-foreground">· {minutes(day.totalMin)}</span></CardTitle></CardHeader><CardContent className="space-y-3">{day.entries.map((entry) => {
      const editable = entry.userId === meId && !entry.lockedAt && !entry.lockKind;
      return <article key={entry.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => editable && onEdit(entry)} aria-label={`Dettaglio ${entry.description}`}><div className="font-medium">{time(entry.startAt)}–{time(entry.endAt)} · {entry.project?.client ? `${entry.project.client} / ` : ""}{entry.project?.name || "Progetto archiviato"}</div><p className="truncate text-sm text-muted-foreground">{entry.description}{entry.task ? ` · ${entry.task}` : ""}</p><div className="mt-1 flex flex-wrap gap-1">{entry.billable && <Badge variant="success">Fatturabile</Badge>}{entry.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}{!editable && (entry.lockedAt || entry.lockKind) && <Badge variant="warning">Bloccata</Badge>}</div></button><div className="flex shrink-0 items-center gap-1"><span className="mr-2 text-sm font-medium">{minutes(entry.durationMin)}</span>{editable && <><Button type="button" size="icon" variant="ghost" onClick={() => onEdit(entry)} aria-label="Modifica attività"><Pencil /></Button><Button type="button" size="icon" variant="ghost" onClick={() => onDuplicate(entry)} aria-label="Duplica in un nuovo modulo"><Copy /></Button><Button type="button" size="icon" variant="ghost" onClick={() => onSplit(entry)} aria-label="Dividi attività"><Scissors /></Button><Button type="button" size="icon" variant="ghost" onClick={() => onDelete(entry)} aria-label="Elimina attività"><Trash2 /></Button></>}</div></article>;
    })}</CardContent></Card>)}</div>;
}
