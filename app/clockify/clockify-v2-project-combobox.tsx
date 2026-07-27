"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ClockifyV2Project } from "./clockify-v2-types";

export function ClockifyV2ProjectCombobox({
  projects,
  value,
  onChange,
  disabled,
  compact = false,
}: {
  projects: ClockifyV2Project[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const selected = projects.find((project) => project.id === value);
  const groups = useMemo(() => {
    const grouped = new Map<string, ClockifyV2Project[]>();
    for (const project of projects) {
      const label = project.client?.trim() || "Senza cliente";
      grouped.set(label, [...(grouped.get(label) || []), project]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right, "it-IT", { sensitivity: "base" }));
  }, [projects]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Seleziona progetto"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", compact && "h-11 min-w-[220px] border-0 bg-transparent shadow-none")}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
            <span className="truncate">
              {selected ? <><span className="font-medium">{selected.name}</span><span className="text-muted-foreground"> · {selected.client || "Senza cliente"}</span></> : "Progetto"}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start" portalled={false}>
        <Command>
          <CommandInput placeholder="Cerca progetto o cliente…" />
          <CommandList>
            <CommandEmpty>Nessun progetto trovato.</CommandEmpty>
            {groups.map(([client, items]) => (
              <CommandGroup key={client} heading={client}>
                {items.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`${project.name} ${client}`}
                    onSelect={() => {
                      onChange(project.id);
                      setOpen(false);
                    }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    <Check className={cn("h-4 w-4", project.id === value ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
