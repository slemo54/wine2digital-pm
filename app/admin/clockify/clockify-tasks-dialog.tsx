"use client";

import { FormEvent, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ClockifyProject, ClockifyTask } from "./catalog-types";

export function ClockifyTasksDialog({ project, tasks, onClose, onCreate, onUpdate }: { project: ClockifyProject | null; tasks: ClockifyTask[]; onClose: () => void; onCreate: (name: string) => Promise<void>; onUpdate: (task: ClockifyTask, patch: { name?: string; isActive?: boolean }) => Promise<void> }): JSX.Element {
  const [name, setName] = useState("");
  async function add(event: FormEvent): Promise<void> { event.preventDefault(); await onCreate(name); setName(""); }
  return <Dialog open={!!project} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Attività · {project?.name}</DialogTitle></DialogHeader><form className="flex gap-2" onSubmit={add}><Input aria-label="Nuova attività" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nuova attività" /><Button type="submit"><Plus className="mr-1 h-4 w-4" />Aggiungi</Button></form><ul className="max-h-64 space-y-2 overflow-auto" aria-label="Attività progetto">{tasks.map((task) => <li key={task.id} className="flex items-center justify-between gap-2 rounded border p-2"><span className={task.isActive ? "" : "text-muted-foreground line-through"}>{task.name}</span><div className="flex gap-1"><Button variant="outline" size="sm" aria-label={`Rinomina ${task.name}`} onClick={() => { const next = window.prompt("Nuovo nome attività", task.name); if (next?.trim() && next.trim() !== task.name) void onUpdate(task, { name: next }); }}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => void onUpdate(task, { isActive: !task.isActive })}>{task.isActive ? "Disattiva" : "Riattiva"}</Button></div></li>)}</ul></DialogContent></Dialog>;
}
