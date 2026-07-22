"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Loader2, Plus, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientCombobox } from "./client-combobox";
import { ClockifyClientsPanel } from "./clockify-clients-panel";
import { ClockifyTasksDialog } from "./clockify-tasks-dialog";
import type { ClockifyClient as Client, ClockifyManager as Manager, ClockifyProject as Project, ClockifyTask as Task } from "./catalog-types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Operazione non riuscita");
  return data as T;
}

export default function ClockifyCatalogPage({ role }: { role: "admin" | "manager" }): JSX.Element {
  const [tab, setTab] = useState("active");
  const [q, setQ] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [taskProject, setTaskProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({ name: "", clientId: "", color: "#6B7280", managerId: "" });
  const status = tab === "archive" ? "archived" : "active";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectData, clientData, managerData] = await Promise.all([
        request<{ projects: Project[] }>(`/api/clockify/v2/projects?status=${status}&q=${encodeURIComponent(q)}`),
        request<{ clients: Client[] }>("/api/clockify/v2/clients"),
        role === "admin" ? request<{ managers: Manager[] }>("/api/clockify/v2/managers") : Promise.resolve({ managers: [] }),
      ]);
      setProjects(projectData.projects); setClients(clientData.clients); setManagers(managerData.managers);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore di caricamento"); }
    finally { setLoading(false); }
  }, [q, role, status]);

  useEffect(() => { void load(); }, [load]);
  const title = useMemo(() => tab === "archive" ? "Archivio progetti" : "Progetti attivi", [tab]);

  function showCreate(): void { setEditing(null); setForm({ name: "", clientId: clients[0]?.id || "", color: "#6B7280", managerId: "" }); setOpen(true); }
  function showEdit(project: Project): void { setEditing(project); setForm({ name: project.name, clientId: project.clientId || "", color: project.color, managerId: project.managerId || "" }); setOpen(true); }
  async function saveProject(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      const body = JSON.stringify({ ...form, managerId: role === "admin" ? form.managerId || null : undefined });
      if (editing) await request(`/api/clockify/v2/projects/${editing.id}`, { method: "PATCH", body });
      else await request("/api/clockify/v2/projects", { method: "POST", body });
      toast.success(editing ? "Progetto aggiornato" : "Progetto creato"); setOpen(false); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Errore salvataggio"); }
  }
  async function createClient(suggestedName?: string): Promise<void> {
    const name = suggestedName?.trim() || window.prompt("Nome del nuovo cliente")?.trim(); if (!name) return;
    try { const data = await request<{ client: Client }>("/api/clockify/v2/clients", { method: "POST", body: JSON.stringify({ name }) }); setClients((current) => [...current, data.client].sort((a, b) => a.name.localeCompare(b.name))); setForm((current) => ({ ...current, clientId: data.client.id })); toast.success("Cliente creato"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Errore cliente"); }
  }
  async function renameClient(client: Client, name: string): Promise<void> {
    try { const data = await request<{ client: Client }>(`/api/clockify/v2/clients/${client.id}`, { method: "PATCH", body: JSON.stringify({ name }) }); setClients((current) => current.map((item) => item.id === client.id ? data.client : item).sort((a, b) => a.name.localeCompare(b.name))); toast.success("Cliente rinominato"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Errore cliente"); }
  }
  async function archive(project: Project, archiveIt: boolean): Promise<void> {
    try { await request(`/api/clockify/v2/projects/${project.id}/${archiveIt ? "archive" : "restore"}`, { method: "POST" }); toast.success(archiveIt ? "Progetto archiviato" : "Progetto ripristinato"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Operazione non riuscita"); }
  }
  async function openTasks(project: Project): Promise<void> {
    try { const data = await request<{ tasks: Task[] }>(`/api/clockify/v2/projects/${project.id}/tasks`); setTaskProject(project); setTasks(data.tasks); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Errore task"); }
  }
  async function createTask(name: string): Promise<void> {
    if (!taskProject) return;
    try { const data = await request<{ task: Task }>(`/api/clockify/v2/projects/${taskProject.id}/tasks`, { method: "POST", body: JSON.stringify({ name }) }); setTasks((current) => [...current, data.task]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Errore task"); }
  }
  async function updateTask(task: Task, patch: { name?: string; isActive?: boolean }): Promise<void> {
    if (!taskProject) return;
    try { const data = await request<{ task: Task }>(`/api/clockify/v2/projects/${taskProject.id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(patch) }); setTasks((current) => current.map((item) => item.id === task.id ? data.task : item)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Errore task"); }
  }

  return <main className="min-h-screen bg-secondary"><div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Settings2 className="h-6 w-6" /> Clockify · Catalogo</h1><p className="text-sm text-muted-foreground">Clienti, progetti e attività per la rendicontazione.</p></div>
    <Tabs value={tab} onValueChange={setTab}><TabsList aria-label="Sezioni catalogo Clockify"><TabsTrigger value="active">Progetti attivi</TabsTrigger><TabsTrigger value="archive">Archivio</TabsTrigger><TabsTrigger value="report">Report</TabsTrigger></TabsList>
      <TabsContent value="report"><Card><CardHeader><CardTitle>Report</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">I report avanzati saranno disponibili nella Fase 5.</CardContent></Card></TabsContent>
      <TabsContent value="active"><div className="space-y-6"><ClockifyClientsPanel clients={clients} onCreate={createClient} onRename={renameClient} /><CatalogList title={title} q={q} setQ={setQ} loading={loading} projects={projects} onCreate={showCreate} onEdit={showEdit} onTasks={openTasks} onArchive={(project) => archive(project, true)} /></div></TabsContent>
      <TabsContent value="archive"><CatalogList title={title} q={q} setQ={setQ} loading={loading} projects={projects} onCreate={showCreate} onEdit={showEdit} onTasks={openTasks} onArchive={(project) => archive(project, false)} archived /></TabsContent>
    </Tabs>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Modifica progetto" : "Nuovo progetto"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={saveProject}>
      <div><Label htmlFor="project-name">Nome progetto</Label><Input id="project-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label htmlFor="project-client">Cliente</Label><ClientCombobox clients={clients} value={form.clientId} onChange={(clientId) => setForm({ ...form, clientId })} onCreate={(name) => void createClient(name)} /></div>
      <div><Label htmlFor="project-color">Colore</Label><Input id="project-color" required pattern="#[0-9a-fA-F]{6}" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
      {role === "admin" && <div><Label htmlFor="project-manager">Responsabile</Label><Select value={form.managerId || "unassigned"} onValueChange={(managerId) => setForm({ ...form, managerId: managerId === "unassigned" ? "" : managerId })}><SelectTrigger id="project-manager"><SelectValue placeholder="Non assegnato" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Non assegnato</SelectItem>{managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name || manager.email}</SelectItem>)}</SelectContent></Select></div>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button><Button type="submit">Salva</Button></DialogFooter></form></DialogContent></Dialog>
    <ClockifyTasksDialog project={taskProject} tasks={tasks} onClose={() => setTaskProject(null)} onCreate={createTask} onUpdate={updateTask} />
  </div></main>;
}

function CatalogList({ title, q, setQ, loading, projects, onCreate, onEdit, onTasks, onArchive, archived = false }: { title: string; q: string; setQ: (value: string) => void; loading: boolean; projects: Project[]; onCreate: () => void; onEdit: (project: Project) => void; onTasks: (project: Project) => void; onArchive: (project: Project) => void; archived?: boolean }): JSX.Element {
  return <Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>{title}</CardTitle><Button onClick={onCreate}><Plus className="mr-1 h-4 w-4" />Nuovo progetto</Button></CardHeader><CardContent className="space-y-4"><Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cerca per progetto o cliente" aria-label="Cerca progetti" />{loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Caricamento…</div> : <div className="space-y-2">{projects.map((project) => <article key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><div className="flex items-center gap-2 font-medium"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />{project.name}{project.origin === "imported" && <Badge variant="secondary">Importato</Badge>}</div><p className="text-sm text-muted-foreground">{project.client}{project.manager ? ` · ${project.manager.name || project.manager.email}` : ""}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => onTasks(project)}>Attività</Button><Button variant="outline" size="sm" onClick={() => onEdit(project)}>Modifica</Button><Button variant="outline" size="sm" onClick={() => onArchive(project)}>{archived ? <><RotateCcw className="mr-1 h-4 w-4" />Ripristina</> : <><Archive className="mr-1 h-4 w-4" />Archivia</>}</Button></div></article>)}{projects.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nessun progetto trovato.</p>}</div>}</CardContent></Card>;
}
