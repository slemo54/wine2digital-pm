"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClockifyV2EntryForm } from "./clockify-v2-entry-form";
import { ClockifyV2EntryList } from "./clockify-v2-entry-list";
import type { ClockifyV2Entry, ClockifyV2Form, ClockifyV2Project, ClockifyV2Warning } from "./clockify-v2-types";

function romeDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const today = (): string => romeDate(new Date());
const initialForm = (): ClockifyV2Form => ({ projectId: "", taskId: "", description: "", tags: "", billable: false, date: today(), startTime: "09:00", endAt: "10:00", durationMin: "60", mode: "end" });
const dateForEntry = (entry: ClockifyV2Entry): string => romeDate(new Date(entry.workDate));
const timeForEntry = (value: string): string => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));

async function request<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data?.error || "Operazione non riuscita"); return data as T; }
function period(): { from: string; to: string } { const end = new Date(`${today()}T12:00:00Z`); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 13); return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }; }

export default function ClockifyV2ClientPage(): JSX.Element {
  const { data: session } = useSession();
  const meId = String((session?.user as { id?: string } | undefined)?.id || "");
  const [projects, setProjects] = useState<ClockifyV2Project[]>([]); const [entries, setEntries] = useState<ClockifyV2Entry[]>([]);
  const [days, setDays] = useState<Array<{ date: string; entries: ClockifyV2Entry[]; totalMin: number; billableMin: number }>>([]); const [weeks, setWeeks] = useState<Array<{ startDate: string; totalMin: number; billableMin: number }>>([]); const [periodTotal, setPeriodTotal] = useState({ totalMin: 0, billableMin: 0 });
  const [form, setForm] = useState<ClockifyV2Form>(initialForm); const [editing, setEditing] = useState<ClockifyV2Entry | null>(null); const [warnings, setWarnings] = useState<ClockifyV2Warning[]>([]); const [saving, setSaving] = useState(false); const [splitEntry, setSplitEntry] = useState<ClockifyV2Entry | null>(null); const [splitAt, setSplitAt] = useState("");
  const load = useCallback(async () => { try { const range = period(); const [catalog, report] = await Promise.all([request<{ projects: ClockifyV2Project[] }>("/api/clockify/v2/entries/catalog"), request<{ entries: ClockifyV2Entry[]; groups: { days: typeof days; weeks: typeof weeks; period: typeof periodTotal } }>(`/api/clockify/v2/entries?from=${range.from}&to=${range.to}`)]); setProjects(catalog.projects); setEntries(report.entries); setDays(report.groups.days); setWeeks(report.groups.weeks); setPeriodTotal(report.groups.period); } catch (error) { toast.error(error instanceof Error ? error.message : "Errore di caricamento"); } }, []);
  useEffect(() => { void load(); }, [load]);
  const tags = useMemo(() => [...new Set(entries.flatMap((entry) => entry.tags || []))].sort(), [entries]);
  async function save(): Promise<void> { setSaving(true); setWarnings([]); try { const payload = { projectId: form.projectId, taskId: form.taskId || null, description: form.description, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), billable: form.billable, date: form.date, startTime: form.startTime, ...(form.mode === "end" ? { endAt: form.endAt } : { durationMin: Number(form.durationMin) }) }; const result = await request<{ warnings: ClockifyV2Warning[] }>(editing ? `/api/clockify/v2/entries/${editing.id}` : "/api/clockify/v2/entries", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) }); setWarnings(result.warnings || []); toast.success(editing ? "Attività aggiornata" : "Attività creata"); setEditing(null); setForm(initialForm()); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito"); } finally { setSaving(false); } }
  function edit(entry: ClockifyV2Entry): void { setEditing(entry); setWarnings([]); setForm({ projectId: entry.projectId, taskId: entry.taskId || "", description: entry.description, tags: (entry.tags || []).join(", "), billable: entry.billable, date: dateForEntry(entry), startTime: timeForEntry(entry.startAt), endAt: timeForEntry(entry.endAt), durationMin: String(entry.durationMin), mode: "end" }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function duplicate(entry: ClockifyV2Entry): void { edit(entry); setEditing(null); toast("Modifica data o orario e salva per creare una copia."); }
  async function remove(entry: ClockifyV2Entry): Promise<void> { if (!window.confirm("Eliminare questa attività?")) return; try { await request(`/api/clockify/v2/entries/${entry.id}`, { method: "DELETE" }); toast.success("Attività eliminata"); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Eliminazione non riuscita"); } }
  async function split(): Promise<void> { if (!splitEntry || !splitAt) return; try { await request(`/api/clockify/v2/entries/${splitEntry.id}/split`, { method: "POST", body: JSON.stringify({ splitAt: new Date(splitAt).toISOString() }) }); setSplitEntry(null); toast.success("Attività divisa"); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Divisione non riuscita"); } }
  return <main className="min-h-screen bg-secondary"><div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Clock3 className="h-6 w-6" />Rendicontazione</h1><p className="text-sm text-muted-foreground">Inserimento manuale delle attività · orari interpretati in Europa/Roma.</p></div><ClockifyV2EntryForm form={form} projects={projects} tagSuggestions={tags} saving={saving} warnings={warnings} onChange={setForm} onSubmit={save} editing={editing} onCancelEdit={() => { setEditing(null); setForm(initialForm()); setWarnings([]); }} /><ClockifyV2EntryList days={days} weeks={weeks} period={periodTotal} meId={meId} onEdit={edit} onDuplicate={duplicate} onSplit={(entry) => { setSplitEntry(entry); setSplitAt(""); }} onDelete={(entry) => void remove(entry)} /><Dialog open={!!splitEntry} onOpenChange={(open) => !open && setSplitEntry(null)}><DialogContent><DialogHeader><DialogTitle>Dividi attività</DialogTitle></DialogHeader><div className="space-y-2"><Label htmlFor="split-at">Istante di divisione</Label><Input id="split-at" type="datetime-local" value={splitAt} onChange={(event) => setSplitAt(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setSplitEntry(null)}>Annulla</Button><Button onClick={() => void split()} disabled={!splitAt}>Dividi</Button></DialogFooter></DialogContent></Dialog></div></main>;
}
