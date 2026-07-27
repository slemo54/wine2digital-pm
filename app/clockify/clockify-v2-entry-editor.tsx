"use client";

import React, { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Copy, Lock, LockOpen, MoreVertical, Scissors, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { clockifyDateInputToDate, formatClockifyDuration } from "./clockify-v2-format";
import { ClockifyV2ProjectCombobox } from "./clockify-v2-project-combobox";
import type { ClockifyV2EditorMode, ClockifyV2Entry, ClockifyV2Form, ClockifyV2Project, ClockifyV2Warning } from "./clockify-v2-types";

type Props = {
  open: boolean;
  mode: ClockifyV2EditorMode;
  form: ClockifyV2Form;
  entry: ClockifyV2Entry | null;
  projects: ClockifyV2Project[];
  tagSuggestions: string[];
  warnings: ClockifyV2Warning[];
  saving: boolean;
  isAdmin: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (form: ClockifyV2Form) => void;
  onSave: () => Promise<void>;
  onDuplicate: (entry: ClockifyV2Entry) => void;
  onSplit: (entry: ClockifyV2Entry) => void;
  onDelete: (entry: ClockifyV2Entry) => Promise<void>;
  onLockChange: (entry: ClockifyV2Entry, locked: boolean) => Promise<void>;
};

function toInputDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ClockifyV2EntryEditor({
  open,
  mode,
  form,
  entry,
  projects,
  tagSuggestions,
  warnings,
  saving,
  isAdmin,
  onOpenChange,
  onChange,
  onSave,
  onDuplicate,
  onSplit,
  onDelete,
  onLockChange,
}: Props): JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const selectedProject = projects.find((project) => project.id === form.projectId);
  const selectedDate = clockifyDateInputToDate(form.date);
  const readonly = mode === "readonly";
  const sourceLocked = Boolean(entry?.effectiveLocked);
  const duplicateTimingOnly = mode === "duplicate";
  const title = mode === "create" ? "Nuova attività" : mode === "duplicate" ? "Duplica attività" : readonly ? "Dettaglio attività" : "Modifica attività";
  const duration = useMemo(() => {
    if (form.mode === "duration") return Number(form.durationMin) || 0;
    const [startHour, startMinute] = form.startTime.split(":").map(Number);
    const [endHour, endMinute] = form.endAt.split(":").map(Number);
    let value = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (value <= 0) value += 24 * 60;
    return Number.isFinite(value) ? value : 0;
  }, [form.durationMin, form.endAt, form.mode, form.startTime]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!readonly) void onSave();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[94vh] max-w-2xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-xl sm:text-2xl">{title}</DialogTitle>
                <DialogDescription className="mt-1">Orari interpretati in Europe/Rome. Nessun timer viene avviato.</DialogDescription>
              </div>
              {entry && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="mr-6" aria-label="Azioni attività">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={sourceLocked} onSelect={() => onDuplicate(entry)}><Copy />Duplica</DropdownMenuItem>
                    <DropdownMenuItem disabled={sourceLocked} onSelect={() => onSplit(entry)}><Scissors />Dividi</DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onSelect={() => void onLockChange(entry, !sourceLocked)}>
                        {sourceLocked ? <LockOpen /> : <Lock />}{sourceLocked ? "Sblocca" : "Blocca"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={sourceLocked} onSelect={() => setDeleteOpen(true)}><Trash2 />Elimina</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
              {sourceLocked && (
                <div className="flex gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" role="status">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Questa attività è bloccata e viene mostrata in sola lettura.</span>
                </div>
              )}
              {duplicateTimingOnly && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Progetto, descrizione, task e tag verranno copiati dall’attività originale. Scegli la nuova data e il nuovo orario.
                </div>
              )}
              <section aria-labelledby="clockify-time-title" className="space-y-3">
                <h3 id="clockify-time-title" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tempo e data</h3>
                <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr_1.25fr]">
                  <div className="flex min-h-11 items-center justify-center rounded-md border bg-muted/35 px-3 text-xl font-bold tabular-nums" aria-label={`Durata ${formatClockifyDuration(duration)}`}>
                    {formatClockifyDuration(duration)}
                  </div>
                  <div>
                    <Label htmlFor="clockify-start" className="sr-only">Ora iniziale</Label>
                    <Input id="clockify-start" type="time" value={form.startTime} disabled={readonly} onChange={(event) => onChange({ ...form, startTime: event.target.value })} />
                  </div>
                  {form.mode === "end" ? (
                    <div>
                      <Label htmlFor="clockify-end" className="sr-only">Ora finale</Label>
                      <Input id="clockify-end" type="time" value={form.endAt} disabled={readonly} onChange={(event) => onChange({ ...form, endAt: event.target.value })} />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="clockify-duration" className="sr-only">Durata in minuti</Label>
                      <Input id="clockify-duration" type="number" min="1" value={form.durationMin} disabled={readonly} onChange={(event) => onChange({ ...form, durationMin: event.target.value })} />
                    </div>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="justify-start font-normal" disabled={readonly}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: it }) : "Scegli data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end" portalled={false}>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && onChange({ ...form, date: toInputDate(date) })}
                        locale={it}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {!readonly && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Inserisci tramite</span>
                    <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="timing-mode" checked={form.mode === "end"} onChange={() => onChange({ ...form, mode: "end" })} /> ora finale</label>
                    <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="timing-mode" checked={form.mode === "duration"} onChange={() => onChange({ ...form, mode: "duration" })} /> durata</label>
                  </div>
                )}
              </section>
              <div className="grid gap-5 border-t pt-6 sm:grid-cols-[150px_1fr] sm:items-start">
                <Label htmlFor="clockify-description" className="pt-2 text-base">Descrizione</Label>
                <Textarea id="clockify-description" rows={3} required value={form.description} disabled={readonly || duplicateTimingOnly} onChange={(event) => onChange({ ...form, description: event.target.value })} placeholder="Che cosa hai fatto?" />
                <Label className="pt-2 text-base">Progetto <span className="text-destructive">*</span></Label>
                <ClockifyV2ProjectCombobox projects={projects} value={form.projectId} onChange={(projectId) => onChange({ ...form, projectId, taskId: "" })} disabled={readonly || duplicateTimingOnly} />
                <Label htmlFor="clockify-task" className="pt-2 text-base">Task</Label>
                <Select value={form.taskId || "none"} onValueChange={(taskId) => onChange({ ...form, taskId: taskId === "none" ? "" : taskId })} disabled={readonly || duplicateTimingOnly || !selectedProject}>
                  <SelectTrigger id="clockify-task"><SelectValue placeholder="Nessuna task" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna task</SelectItem>
                    {(selectedProject?.tasks || []).map((task) => <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Label htmlFor="clockify-tags" className="pt-2 text-base">Tag</Label>
                <div>
                  <Input id="clockify-tags" list="clockify-tag-suggestions" value={form.tags} disabled={readonly || duplicateTimingOnly} onChange={(event) => onChange({ ...form, tags: event.target.value })} placeholder="es. riunione, cliente" />
                  <datalist id="clockify-tag-suggestions">{tagSuggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
                  <p className="mt-1 text-xs text-muted-foreground">Separa più tag con una virgola.</p>
                </div>
                <span className="text-base">Fatturabile</span>
                <div className="flex items-center gap-3 pt-1">
                  <Switch id="clockify-billable" checked={form.billable} disabled={readonly || duplicateTimingOnly} onCheckedChange={(checked) => onChange({ ...form, billable: checked })} />
                  <Label htmlFor="clockify-billable">{form.billable ? "Sì" : "No"}</Label>
                </div>
              </div>
              {warnings.length > 0 && (
                <div className="flex gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" role="status">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}</div>
                </div>
              )}
            </div>
            <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4 sm:px-7">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Chiudi</Button>
              {!readonly && <Button type="submit" disabled={saving || !form.projectId || !form.description.trim()}>{saving ? "Salvataggio…" : mode === "duplicate" ? "Duplica" : "Salva"}</Button>}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa attività?</AlertDialogTitle>
            <AlertDialogDescription>L’attività non comparirà più nel timesheet. L’operazione resta registrata nell’audit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => entry && void onDelete(entry)}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
