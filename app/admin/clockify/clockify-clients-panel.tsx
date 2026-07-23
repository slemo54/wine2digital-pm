"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ClockifyClient } from "./catalog-types";

export function ClockifyClientsPanel({ clients, onCreate, onRename }: { clients: ClockifyClient[]; onCreate: (name: string) => Promise<void>; onRename: (client: ClockifyClient, name: string) => Promise<void> }): JSX.Element {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const visible = useMemo(() => clients.filter((client) => client.name.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT"))), [clients, query]);
  return <Card><CardHeader><CardTitle>Clienti</CardTitle></CardHeader><CardContent className="space-y-3"><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void onCreate(name).then(() => setName("")); }}><Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nuovo cliente" aria-label="Nuovo cliente" /><Button type="submit"><Plus className="mr-1 h-4 w-4" />Aggiungi</Button></form><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca clienti" aria-label="Cerca clienti" /><ul className="max-h-52 divide-y overflow-auto rounded border">{visible.map((client) => <li key={client.id} className="flex items-center justify-between p-2 text-sm"><span>{client.name}</span><Button variant="ghost" size="sm" aria-label={`Rinomina ${client.name}`} onClick={() => { const next = window.prompt("Nuovo nome cliente", client.name); if (next?.trim()) void onRename(client, next); }}><Pencil className="h-4 w-4" /></Button></li>)}{visible.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nessun cliente trovato.</li>}</ul></CardContent></Card>;
}
