"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClockifyV2Entry, ClockifyV2Form, ClockifyV2Project, ClockifyV2Warning } from "./clockify-v2-types";

type Props = {
  form: ClockifyV2Form; projects: ClockifyV2Project[]; tagSuggestions: string[]; saving: boolean; warnings: ClockifyV2Warning[];
  onChange: (form: ClockifyV2Form) => void; onSubmit: () => Promise<void>; editing?: ClockifyV2Entry | null; onCancelEdit: () => void;
};

export function ClockifyV2EntryForm({ form, projects, tagSuggestions, saving, warnings, onChange, onSubmit, editing, onCancelEdit }: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const visibleProjects = useMemo(() => projects.filter((project) => `${project.client} ${project.name}`.toLocaleLowerCase("it-IT").includes(search.toLocaleLowerCase("it-IT"))), [projects, search]);
  const grouped = useMemo(() => visibleProjects.reduce<Record<string, ClockifyV2Project[]>>((groups, project) => ({ ...groups, [project.client || "Senza cliente"]: [...(groups[project.client || "Senza cliente"] || []), project] }), {}), [visibleProjects]);
  const selected = projects.find((project) => project.id === form.projectId);
  const submit = (event: FormEvent): void => { event.preventDefault(); void onSubmit(); };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />{editing ? "Modifica attività" : "Nuova attività"}</CardTitle></CardHeader><CardContent>
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="v2-project-search">Cerca progetto o cliente</Label><Input id="v2-project-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digita per filtrare" /></div>
      <div className="space-y-2"><Label htmlFor="v2-project">Progetto</Label><Select value={form.projectId} onValueChange={(projectId) => onChange({ ...form, projectId, taskId: "" })}><SelectTrigger id="v2-project" aria-label="Progetto"><SelectValue placeholder="Seleziona un progetto" /></SelectTrigger><SelectContent>{Object.entries(grouped).map(([client, items]) => <SelectGroup key={client}><SelectLabel>{client}</SelectLabel>{items.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectGroup>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="v2-task">Attività</Label><Select value={form.taskId || "none"} onValueChange={(taskId) => onChange({ ...form, taskId: taskId === "none" ? "" : taskId })} disabled={!selected}><SelectTrigger id="v2-task"><SelectValue placeholder="Nessuna attività" /></SelectTrigger><SelectContent><SelectItem value="none">Nessuna attività</SelectItem>{selected?.tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="v2-description">Descrizione</Label><Input id="v2-description" required value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="v2-tags">Tag</Label><Input id="v2-tags" list="v2-tag-suggestions" value={form.tags} onChange={(event) => onChange({ ...form, tags: event.target.value })} placeholder="es. riunione, cliente" /><datalist id="v2-tag-suggestions">{tagSuggestions.map((tag) => <option key={tag} value={tag} />)}</datalist></div>
      <div className="flex items-end gap-2 pb-2"><Checkbox id="v2-billable" checked={form.billable} onCheckedChange={(checked) => onChange({ ...form, billable: checked === true })} /><Label htmlFor="v2-billable">Fatturabile</Label></div>
      <div className="space-y-2"><Label htmlFor="v2-date">Data</Label><Input id="v2-date" type="date" required value={form.date} onChange={(event) => onChange({ ...form, date: event.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="v2-start">Inizio (Europa/Roma)</Label><Input id="v2-start" type="time" required value={form.startTime} onChange={(event) => onChange({ ...form, startTime: event.target.value })} /></div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Fine o durata</legend><div className="flex gap-4 text-sm"><label className="flex items-center gap-1"><input type="radio" checked={form.mode === "end"} onChange={() => onChange({ ...form, mode: "end" })} /> Fine</label><label className="flex items-center gap-1"><input type="radio" checked={form.mode === "duration"} onChange={() => onChange({ ...form, mode: "duration" })} /> Durata</label></div>{form.mode === "end" ? <Input aria-label="Fine" type="time" required value={form.endAt} onChange={(event) => onChange({ ...form, endAt: event.target.value })} /> : <Input aria-label="Durata in minuti" type="number" min="1" required value={form.durationMin} onChange={(event) => onChange({ ...form, durationMin: event.target.value })} />}</fieldset>
      <div className="flex items-end justify-end gap-2">{editing && <Button type="button" variant="outline" onClick={onCancelEdit}>Annulla</Button>}<Button type="submit" disabled={saving}>{saving ? "Salvataggio…" : editing ? "Aggiorna" : "Salva attività"}</Button></div>
      {warnings.length > 0 && <div className="flex gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm md:col-span-2" role="status"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div>{warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}</div></div>}
    </form>
  </CardContent></Card>;
}
