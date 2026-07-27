"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ClockifyFilterOption = { value: string; label: string; description?: string; color?: string; disabled?: boolean };

export function ClockifyFilterCombobox({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: ClockifyFilterOption[];
  placeholder: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="flex min-w-0 items-center gap-2">
            {selected?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
            <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cerca ${placeholder.toLocaleLowerCase("it-IT")}…`} />
          <CommandList>
            <CommandEmpty>Nessun risultato.</CommandEmpty>
            <CommandItem value={`tutti ${placeholder}`} onSelect={() => { onChange(""); setOpen(false); }}>
              <span className="min-w-0 flex-1">Tutti</span><Check className={cn("h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
            </CommandItem>
            {options.map((option) => (
              <CommandItem key={option.value} value={`${option.label} ${option.description || ""}`} disabled={option.disabled} onSelect={() => { onChange(option.value); setOpen(false); }}>
                {option.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />}
                <span className="min-w-0 flex-1"><span className="block truncate">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span>
                <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
