"use client";

import { FormEvent, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ClockifyProject, ClockifyTask } from "./catalog-types";

export function ClockifyTasksDialog({ project, tasks, onClose, onCreate, onUpdate }: { project: ClockifyProject | null; tasks: ClockifyTask[]; onClose: () => void; onCreate: (name: string) => Promise<void>; onUpdate: (task: ClockifyTask, patch: { name?: string; isActive?: boolean }) => Promise<void> }): JSX.Element {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  async function add(event: FormEvent): Promise<void> { event.preventDefault(); try { await onCreate(name); setName(""); } catch { /* Preserve the draft. */ } }
  async function save(task: ClockifyTask): Promise<void> {
    if (!draft.trim() || draft.trim() === task.name) { setEditingId(null); return; }
    try {
      await onUpdate(task, { name: draft });
      setEditingId(null);
    } catch {
      // Preserve the inline editor and draft.
    }
  }
  return (
    <Dialog open={!!project} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Task Clockify · {project?.name}</DialogTitle><DialogDescription>Catalogo autonomo usato nelle registrazioni e nei report. Le task referenziate vengono disattivate, non eliminate.</DialogDescription></DialogHeader>
        <form className="flex gap-2" onSubmit={(event) => void add(event)}><Input aria-label="Nuova task Clockify" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nuova task" /><Button type="submit"><Plus className="mr-1 h-4 w-4" />Aggiungi</Button></form>
        <ul className="max-h-[420px] space-y-2 overflow-auto" aria-label="Task del progetto">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              {editingId === task.id ? (
                <div className="flex min-w-0 flex-1 gap-2">
                  <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(task); } if (event.key === "Escape") setEditingId(null); }} autoFocus />
                  <Button size="icon" aria-label="Salva nome task" onClick={() => void save(task)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Annulla modifica task" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : <span className={task.isActive ? "font-medium" : "font-medium text-muted-foreground line-through"}>{task.name}</span>}
              {editingId !== task.id && <div className="flex gap-1"><Button variant="outline" size="icon" aria-label={`Rinomina ${task.name}`} onClick={() => { setEditingId(task.id); setDraft(task.name); }}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => { void onUpdate(task, { isActive: !task.isActive }).catch(() => undefined); }}>{task.isActive ? "Disattiva" : "Riattiva"}</Button></div>}
            </li>
          ))}
          {tasks.length === 0 && <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nessuna task nel progetto.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
