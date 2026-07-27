"use client";

import { FormEvent } from "react";
import { CalendarDays, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClockifyV2ProjectCombobox } from "./clockify-v2-project-combobox";
import type { ClockifyV2Form, ClockifyV2Project } from "./clockify-v2-types";

type Props = {
  form: ClockifyV2Form;
  projects: ClockifyV2Project[];
  saving: boolean;
  onChange: (form: ClockifyV2Form) => void;
  onSubmit: () => Promise<void>;
  onOpenEditor: () => void;
};

export function ClockifyV2EntryForm({ form, projects, saving, onChange, onSubmit, onOpenEditor }: Props): JSX.Element {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };
  return (
    <>
      <Button className="w-full lg:hidden" size="lg" onClick={onOpenEditor}>
        <Plus className="mr-2 h-4 w-4" />Nuova attività
      </Button>
      <form onSubmit={submit} className="hidden min-h-[64px] items-stretch overflow-visible rounded-xl border bg-card shadow-sm lg:flex">
        <div className="min-w-0 flex-1 border-r">
          <label htmlFor="clockify-quick-description" className="sr-only">Descrizione nuova attività</label>
          <Input
            id="clockify-quick-description"
            className="h-full rounded-none border-0 bg-transparent px-5 text-base shadow-none focus-visible:ring-0"
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
            placeholder="A cosa stai lavorando?"
          />
        </div>
        <div className="flex w-[280px] items-center border-r px-2">
          <ClockifyV2ProjectCombobox compact projects={projects} value={form.projectId} onChange={(projectId) => onChange({ ...form, projectId, taskId: "" })} />
        </div>
        <label className="flex w-[150px] items-center gap-2 border-r px-3 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <Input aria-label="Data nuova attività" type="date" className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" value={form.date} onChange={(event) => onChange({ ...form, date: event.target.value })} />
        </label>
        <div className="flex items-center gap-1 border-r px-3">
          <Input aria-label="Ora iniziale nuova attività" type="time" className="w-[94px]" value={form.startTime} onChange={(event) => onChange({ ...form, startTime: event.target.value })} />
          <span className="text-muted-foreground">–</span>
          <Input aria-label="Ora finale nuova attività" type="time" className="w-[94px]" value={form.endAt} onChange={(event) => onChange({ ...form, endAt: event.target.value, mode: "end" })} />
        </div>
        <Button type="button" variant="ghost" size="icon" className="m-auto mx-2 shrink-0" aria-label="Apri editor completo" onClick={onOpenEditor}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        <Button type="submit" className="m-2 min-w-[112px]" disabled={saving || !form.projectId || !form.description.trim()}>
          {saving ? "Salvo…" : "Aggiungi"}
        </Button>
      </form>
    </>
  );
}
