"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarRange, Clock3, List, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClockifyV2Calendar, getClockifyCalendarRange, type ClockifyCalendarView } from "./clockify-v2-calendar";
import { ClockifyV2EntryEditor } from "./clockify-v2-entry-editor";
import { ClockifyV2EntryForm } from "./clockify-v2-entry-form";
import { ClockifyV2EntryList } from "./clockify-v2-entry-list";
import { clockifyRomeDate, clockifyRomeTime } from "./clockify-v2-format";
import { clockifyRequest } from "./clockify-v2-request";
import type { ClockifyV2EditorMode, ClockifyV2Entry, ClockifyV2Form, ClockifyV2Project, ClockifyV2Warning } from "./clockify-v2-types";

type Day = { date: string; entries: ClockifyV2Entry[]; totalMin: number; billableMin: number };
type Week = { startDate: string; totalMin: number; billableMin: number };
type EntriesResponse = { entries: ClockifyV2Entry[]; groups: { days: Day[]; weeks: Week[]; period: { totalMin: number; billableMin: number } }; nextCursor: string | null };

const initialForm = (): ClockifyV2Form => ({
  projectId: "",
  taskId: "",
  description: "",
  tags: "",
  billable: false,
  date: clockifyRomeDate(new Date()),
  startTime: "09:00",
  endAt: "10:00",
  durationMin: "60",
  mode: "end",
});
function formForEntry(entry: ClockifyV2Entry): ClockifyV2Form {
  return {
    projectId: entry.projectId,
    taskId: entry.taskId || "",
    description: entry.description,
    tags: (entry.tags || []).join(", "),
    billable: entry.billable,
    date: clockifyRomeDate(entry.workDate),
    startTime: clockifyRomeTime(entry.startAt),
    endAt: clockifyRomeTime(entry.endAt),
    durationMin: String(entry.durationMin),
    mode: "end",
  };
}
function entryPayload(form: ClockifyV2Form): Record<string, unknown> {
  return {
    projectId: form.projectId,
    taskId: form.taskId || null,
    description: form.description,
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    billable: form.billable,
    date: form.date,
    startTime: form.startTime,
    ...(form.mode === "end" ? { endAt: form.endAt } : { durationMin: Number(form.durationMin) }),
  };
}

export default function ClockifyV2ClientPage(): JSX.Element {
  const { data: session } = useSession();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  const isAdmin = sessionUser?.role === "admin";
  const [projects, setProjects] = useState<ClockifyV2Project[]>([]);
  const [entries, setEntries] = useState<ClockifyV2Entry[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [periodTotal, setPeriodTotal] = useState({ totalMin: 0, billableMin: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [calendarView, setCalendarView] = useState<ClockifyCalendarView>("week");
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [section, setSection] = useState<"list" | "calendar">("list");
  const [form, setForm] = useState<ClockifyV2Form>(initialForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<ClockifyV2EditorMode>("create");
  const [selectedEntry, setSelectedEntry] = useState<ClockifyV2Entry | null>(null);
  const [warnings, setWarnings] = useState<ClockifyV2Warning[]>([]);
  const [saving, setSaving] = useState(false);
  const [splitEntry, setSplitEntry] = useState<ClockifyV2Entry | null>(null);
  const [splitDate, setSplitDate] = useState("");
  const [splitTime, setSplitTime] = useState("");
  const range = useMemo(() => getClockifyCalendarRange(calendarView, calendarAnchor), [calendarAnchor, calendarView]);

  const load = useCallback(async (cursor?: string) => {
    try {
      const [catalog, report] = await Promise.all([
        cursor ? Promise.resolve(null) : clockifyRequest<{ projects: ClockifyV2Project[] }>("/api/clockify/v2/entries/catalog"),
        clockifyRequest<EntriesResponse>(`/api/clockify/v2/entries?from=${range.from}&to=${range.to}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
      ]);
      if (catalog) setProjects(catalog.projects);
      setEntries((current) => cursor ? mergeEntries(current, report.entries) : report.entries);
      setDays((current) => cursor ? mergeDays(current, report.groups.days) : report.groups.days);
      setWeeks((current) => cursor ? mergeWeeks(current, report.groups.weeks) : report.groups.weeks);
      setPeriodTotal(report.groups.period);
      setNextCursor(report.nextCursor);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore di caricamento");
    }
  }, [range.from, range.to]);
  useEffect(() => { void load(); }, [load]);

  const tags = useMemo(() => [...new Set(entries.flatMap((entry) => entry.tags || []))].sort((left, right) => left.localeCompare(right, "it-IT")), [entries]);
  function openCreate(useCurrentDraft = false): void {
    if (!useCurrentDraft) setForm(initialForm());
    setSelectedEntry(null);
    setEditorMode("create");
    setWarnings([]);
    setEditorOpen(true);
  }
  function openEntry(entry: ClockifyV2Entry): void {
    setSelectedEntry(entry);
    setForm(formForEntry(entry));
    setEditorMode(entry.effectiveLocked ? "readonly" : "edit");
    setWarnings([]);
    setEditorOpen(true);
  }
  function openDuplicate(entry: ClockifyV2Entry): void {
    setSelectedEntry(entry);
    setForm(formForEntry(entry));
    setEditorMode("duplicate");
    setWarnings([]);
    setEditorOpen(true);
  }
  function openSplit(entry: ClockifyV2Entry): void {
    setEditorOpen(false);
    setSplitEntry(entry);
    setSplitDate(clockifyRomeDate(entry.startAt));
    setSplitTime(clockifyRomeTime(new Date(new Date(entry.startAt).getTime() + Math.floor(entry.durationMin / 2) * 60_000)));
  }
  async function save(quick = false): Promise<void> {
    setSaving(true);
    setWarnings([]);
    try {
      const payload = entryPayload(form);
      const target = editorMode === "duplicate" && selectedEntry
        ? `/api/clockify/v2/entries/${selectedEntry.id}/duplicate`
        : editorMode === "edit" && selectedEntry
          ? `/api/clockify/v2/entries/${selectedEntry.id}`
          : "/api/clockify/v2/entries";
      const method = editorMode === "edit" ? "PATCH" : "POST";
      const body = editorMode === "duplicate"
        ? { date: form.date, startTime: form.startTime, ...(form.mode === "end" ? { endAt: form.endAt } : { durationMin: Number(form.durationMin) }) }
        : payload;
      const result = await clockifyRequest<{ warnings?: ClockifyV2Warning[] }>(target, { method, body: JSON.stringify(body) });
      const savedWarnings = result.warnings || [];
      setWarnings(savedWarnings);
      if (savedWarnings.length) savedWarnings.forEach((warning) => toast(warning.message));
      toast.success(editorMode === "duplicate" ? "Attività duplicata" : editorMode === "edit" ? "Attività aggiornata" : "Attività creata");
      setEditorOpen(false);
      setSelectedEntry(null);
      setEditorMode("create");
      setForm(initialForm());
      await load();
    } catch (error) {
      // Intentionally preserve both editor state and draft on server errors.
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito");
      if (quick) setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  }
  async function remove(entry: ClockifyV2Entry): Promise<void> {
    try {
      await clockifyRequest(`/api/clockify/v2/entries/${entry.id}`, { method: "DELETE" });
      setEditorOpen(false);
      toast.success("Attività eliminata");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eliminazione non riuscita");
    }
  }
  async function split(): Promise<void> {
    if (!splitEntry || !splitDate || !splitTime) return;
    try {
      await clockifyRequest(`/api/clockify/v2/entries/${splitEntry.id}/split`, { method: "POST", body: JSON.stringify({ splitDate, splitTime }) });
      setSplitEntry(null);
      toast.success("Attività divisa");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Divisione non riuscita");
    }
  }
  async function changeLock(entry: ClockifyV2Entry, locked: boolean): Promise<void> {
    try {
      await clockifyRequest(`/api/clockify/v2/entries/${entry.id}/lock`, { method: locked ? "POST" : "DELETE" });
      toast.success(locked ? "Attività bloccata" : "Attività sbloccata");
      setEditorOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operazione non riuscita");
    }
  }
  async function loadMore(): Promise<void> {
    if (!nextCursor) return;
    setLoadingMore(true);
    try { await load(nextCursor); } finally { setLoadingMore(false); }
  }

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-[1500px] space-y-5 px-3 py-5 sm:px-6 sm:py-7">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Clock3 className="h-7 w-7 text-primary" />Rendicontazione</h1>
            <p className="mt-1 text-sm text-muted-foreground">Inserimento esclusivamente manuale · nessun timer attivo.</p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Navigazione Clockify">
            <Button asChild variant="outline" size="sm"><Link href="/clockify/reports"><BarChart3 className="mr-2 h-4 w-4" />Report</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/clockify/audit"><ShieldCheck className="mr-2 h-4 w-4" />Audit</Link></Button>
          </nav>
        </header>
        <ClockifyV2EntryForm form={form} projects={projects} saving={saving} onChange={setForm} onSubmit={() => save(true)} onOpenEditor={() => openCreate(true)} />
        <Tabs value={section} onValueChange={(value) => setSection(value as "list" | "calendar")}>
          <TabsList className="grid w-full grid-cols-2 sm:w-[320px]">
            <TabsTrigger value="list"><List className="mr-2 h-4 w-4" />Elenco</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarRange className="mr-2 h-4 w-4" />Calendario</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-5">
            <ClockifyV2EntryList days={days} weeks={weeks} period={periodTotal} onView={openEntry} />
          </TabsContent>
          <TabsContent value="calendar" className="mt-5">
            <ClockifyV2Calendar entries={entries} onView={openEntry} view={calendarView} anchor={calendarAnchor} onViewChange={setCalendarView} onAnchorChange={setCalendarAnchor} />
          </TabsContent>
        </Tabs>
        {nextCursor && <div className="flex justify-center"><Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Caricamento…" : "Carica altre attività"}</Button></div>}
      </div>
      <ClockifyV2EntryEditor
        open={editorOpen}
        mode={editorMode}
        form={form}
        entry={selectedEntry}
        projects={projects}
        tagSuggestions={tags}
        warnings={warnings}
        saving={saving}
        isAdmin={isAdmin}
        onOpenChange={setEditorOpen}
        onChange={setForm}
        onSave={() => save(false)}
        onDuplicate={openDuplicate}
        onSplit={openSplit}
        onDelete={remove}
        onLockChange={changeLock}
      />
      <Dialog open={!!splitEntry} onOpenChange={(open) => !open && setSplitEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dividi attività</DialogTitle>
            <DialogDescription>Scegli il punto esatto: la durata totale e tutti i metadati verranno conservati.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="split-date">Data</Label><Input id="split-date" type="date" value={splitDate} onChange={(event) => setSplitDate(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="split-time">Ora</Label><Input id="split-time" type="time" value={splitTime} onChange={(event) => setSplitTime(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSplitEntry(null)}>Annulla</Button><Button onClick={() => void split()} disabled={!splitDate || !splitTime}>Dividi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function mergeEntries(current: ClockifyV2Entry[], incoming: ClockifyV2Entry[]): ClockifyV2Entry[] {
  const map = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => map.set(entry.id, entry));
  return [...map.values()].sort((left, right) => right.startAt.localeCompare(left.startAt) || right.id.localeCompare(left.id));
}
function mergeDays(current: Day[], incoming: Day[]): Day[] {
  const map = new Map(current.map((day) => [day.date, day]));
  for (const day of incoming) {
    const previous = map.get(day.date);
    if (!previous) map.set(day.date, day);
    else {
      const entries = mergeEntries(previous.entries, day.entries);
      map.set(day.date, {
        date: day.date,
        entries,
        totalMin: entries.reduce((sum, entry) => sum + entry.durationMin, 0),
        billableMin: entries.reduce((sum, entry) => sum + (entry.billable ? entry.durationMin : 0), 0),
      });
    }
  }
  return [...map.values()].sort((left, right) => right.date.localeCompare(left.date));
}
function mergeWeeks(current: Week[], incoming: Week[]): Week[] {
  const map = new Map(current.map((week) => [week.startDate, week]));
  for (const week of incoming) {
    const previous = map.get(week.startDate);
    map.set(week.startDate, previous ? { ...previous, totalMin: previous.totalMin + week.totalMin, billableMin: previous.billableMin + week.billableMin } : week);
  }
  return [...map.values()].sort((left, right) => right.startDate.localeCompare(left.startDate));
}
