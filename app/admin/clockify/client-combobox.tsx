"use client";

import { FocusEvent, KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClockifyClient } from "./catalog-types";

export function nextClientComboboxIndex(key: string, activeIndex: number, count: number): number {
  if (count === 0 || key === "Escape") return -1;
  if (key === "ArrowDown") return (activeIndex + 1 + count) % count;
  if (key === "ArrowUp") return (activeIndex - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return activeIndex;
}

export function shouldCloseClientCombobox(container: Pick<Node, "contains">, relatedTarget: Node | null): boolean {
  return !relatedTarget || !container.contains(relatedTarget);
}

export function ClientCombobox({ clients, value, onChange, onCreate, inputId }: { clients: ClockifyClient[]; value: string; onChange: (id: string) => void; onCreate: (suggestedName: string) => void; inputId?: string }): JSX.Element {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const matches = useMemo(() => clients.filter((client) => client.name.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT"))), [clients, query]);
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${matches[activeIndex]?.id}` : undefined;
  function selectClient(client: ClockifyClient): void { onChange(client.id); setQuery(client.name); setActiveIndex(-1); setExpanded(false); }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); setExpanded(true); setActiveIndex(nextClientComboboxIndex(event.key, activeIndex, matches.length)); return;
    }
    if (event.key === "Escape") { event.preventDefault(); setExpanded(false); setActiveIndex(-1); return; }
    if (event.key === "Enter" && expanded && activeIndex >= 0 && matches[activeIndex]) {
      event.preventDefault(); selectClient(matches[activeIndex]);
    }
  }
  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    if (containerRef.current && shouldCloseClientCombobox(containerRef.current, event.relatedTarget as Node | null)) {
      setExpanded(false); setActiveIndex(-1); setQuery("");
    }
  }
  return <div ref={containerRef} onBlur={handleBlur} className="space-y-2">
    <Input id={inputId} value={query} onFocus={() => setExpanded(true)} onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); setExpanded(true); }} onKeyDown={handleKeyDown} placeholder="Cerca o crea un cliente" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-haspopup="listbox" aria-controls={listboxId} aria-activedescendant={activeOptionId} aria-label="Cerca cliente" />
    {expanded && <div id={listboxId} role="listbox" aria-label="Clienti disponibili" className="max-h-40 overflow-auto rounded-md border p-1">
      {matches.map((client, index) => <button id={`${listboxId}-option-${client.id}`} key={client.id} type="button" role="option" aria-selected={value === client.id} className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${index === activeIndex || value === client.id ? "bg-accent" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => selectClient(client)}>{client.name}</button>)}
      {matches.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Nessun cliente trovato.</p>}
    </div>}
    <Button type="button" variant="outline" size="sm" onClick={() => onCreate(query)}><Plus className="mr-1 h-4 w-4" />Crea “{query.trim() || "nuovo cliente"}”</Button>
  </div>;
}
