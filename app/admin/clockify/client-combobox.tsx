"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClockifyClient } from "./catalog-types";

export function ClientCombobox({ clients, value, onChange, onCreate }: { clients: ClockifyClient[]; value: string; onChange: (id: string) => void; onCreate: (suggestedName: string) => void }): JSX.Element {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => clients.filter((client) => client.name.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT"))), [clients, query]);
  return <div className="space-y-2">
    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca o crea un cliente" role="combobox" aria-expanded="true" aria-controls="client-options" aria-label="Cerca cliente" />
    <div id="client-options" role="listbox" className="max-h-40 overflow-auto rounded-md border p-1">
      {matches.map((client) => <button key={client.id} type="button" role="option" aria-selected={value === client.id} className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${value === client.id ? "bg-accent" : ""}`} onClick={() => onChange(client.id)}>{client.name}</button>)}
      {matches.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Nessun cliente trovato.</p>}
    </div>
    <Button type="button" variant="outline" size="sm" onClick={() => onCreate(query)}><Plus className="mr-1 h-4 w-4" />Crea “{query.trim() || "nuovo cliente"}”</Button>
  </div>;
}
