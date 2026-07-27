"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClockifyClient } from "./catalog-types";

export function ClockifyClientsPanel({ clients, canRename, onCreate, onRename }: { clients: ClockifyClient[]; canRename: boolean; onCreate: (name: string) => Promise<void>; onRename: (client: ClockifyClient, name: string) => Promise<void> }): JSX.Element {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<ClockifyClient | null>(null);
  const [rename, setRename] = useState("");
  const visible = useMemo(() => clients.filter((client) => client.name.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT"))), [clients, query]);
  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await onCreate(name);
      setName("");
    } catch {
      // Keep the entered name available for correction.
    }
  }
  async function saveRename(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editing || !rename.trim()) return;
    try {
      await onRename(editing, rename);
      setEditing(null);
    } catch {
      // Keep the dialog and draft open when the server rejects the rename.
    }
  }
  return (
    <>
      <Card>
        <CardHeader><CardTitle>Clienti</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex gap-2" onSubmit={(event) => void create(event)}><Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nuovo cliente" aria-label="Nuovo cliente" /><Button type="submit"><Plus className="mr-1 h-4 w-4" />Aggiungi</Button></form>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca clienti" aria-label="Cerca clienti" />
          <ul className="max-h-64 divide-y overflow-auto rounded-lg border">
            {visible.map((client) => <li key={client.id} className="flex items-center justify-between px-3 py-2.5 text-sm"><span className="font-medium">{client.name}</span>{canRename && <Button variant="ghost" size="icon" aria-label={`Rinomina ${client.name}`} onClick={() => { setEditing(client); setRename(client.name); }}><Pencil className="h-4 w-4" /></Button>}</li>)}
            {visible.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nessun cliente trovato.</li>}
          </ul>
        </CardContent>
      </Card>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rinomina cliente</DialogTitle><DialogDescription>I progetti collegati continueranno a conservare tutte le registrazioni storiche.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void saveRename(event)}>
            <div className="space-y-2"><Label htmlFor="clockify-client-name">Nome cliente</Label><Input id="clockify-client-name" autoFocus required value={rename} onChange={(event) => setRename(event.target.value)} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Annulla</Button><Button type="submit" disabled={!rename.trim()}>Salva</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
