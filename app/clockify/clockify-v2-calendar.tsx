"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClockifyV2Entry } from "./clockify-v2-types";

type View = "day" | "week" | "month";
function romeDate(value: Date): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const p = (key: string) => parts.find((part) => part.type === key)?.value || ""; return `${p("year")}-${p("month")}-${p("day")}`; }
function addDays(value: Date, days: number): Date { const copy = new Date(value); copy.setUTCDate(copy.getUTCDate() + days); return copy; }

export function ClockifyV2Calendar({ entries, onView }: { entries: ClockifyV2Entry[]; onView: (entry: ClockifyV2Entry) => void }): JSX.Element {
  const [view, setView] = useState<View>("week"); const [anchor, setAnchor] = useState(() => new Date());
  const dates = useMemo(() => { const step = view === "day" ? 1 : view === "week" ? 7 : 31; return Array.from({ length: view === "day" ? 1 : view === "week" ? 7 : 31 }, (_, index) => romeDate(addDays(anchor, index))); }, [anchor, view]);
  const byDate = useMemo(() => new Map(dates.map((date) => [date, entries.filter((entry) => romeDate(new Date(entry.workDate)) === date)])), [dates, entries]);
  const step = view === "day" ? 1 : view === "week" ? 7 : 31;
  return <section className="rounded-lg border bg-card p-4" aria-label="Calendario rendicontazione"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1" role="group" aria-label="Vista calendario">{(["day", "week", "month"] as View[]).map((item) => <Button key={item} size="sm" variant={view === item ? "default" : "outline"} onClick={() => setView(item)}>{item === "day" ? "Giorno" : item === "week" ? "Settimana" : "Mese"}</Button>)}</div><div className="flex items-center gap-1"><Button size="icon" variant="outline" aria-label="Periodo precedente" onClick={() => setAnchor((value) => addDays(value, -step))}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-28 text-center text-sm font-medium">{dates[0]}{dates.length > 1 ? ` – ${dates[dates.length - 1]}` : ""}</span><Button size="icon" variant="outline" aria-label="Periodo successivo" onClick={() => setAnchor((value) => addDays(value, step))}><ChevronRight className="h-4 w-4" /></Button></div></div><div className={view === "month" ? "grid gap-2 sm:grid-cols-4 lg:grid-cols-7" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-7"}>{dates.map((date) => <div key={date} className="min-h-20 rounded border p-2"><div className="mb-1 text-xs font-medium">{date}</div>{(byDate.get(date) || []).map((entry) => <button key={entry.id} type="button" className="mb-1 block w-full truncate rounded bg-secondary px-2 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onView(entry)} aria-label={`Apri ${entry.description}`}>{entry.description}</button>)}</div>)}</div></section>;
}
