"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clockifyRequest } from "../clockify-v2-request";
import { clockifyRomeDate, formatClockifyDay, formatClockifyDuration } from "../clockify-v2-format";

const choices = [
  ["all", "Tutte le anomalie"],
  ["overlap", "Sovrapposizione"],
  ["duration_short", "Durata inferiore a 5 minuti"],
  ["duration_long", "Durata superiore a 12 ore"],
  ["temporal_inconsistency", "Orari e durata incoerenti"],
  ["missing_project", "Progetto mancante"],
  ["missing_task", "Task mancante"],
  ["active_lock_missing", "Metadati del blocco incoerenti"],
  ["unlocked", "Registrazione non bloccata"],
] as const;
const labels = Object.fromEntries(choices.slice(1));

function defaultPeriod(): string {
  const today = clockifyRomeDate(new Date());
  return new URLSearchParams({ from: `${today.slice(0, 7)}-01`, to: today }).toString();
}

export function ClockifyAuditPanel({ appliedParams = defaultPeriod() }: { appliedParams?: string }): JSX.Element {
  const [anomaly, setAnomaly] = useState("all");
  const [data, setData] = useState<any>({ entries: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const query = new URLSearchParams(appliedParams);
      if (anomaly !== "all") query.set("anomaly", anomaly);
      if (cursor) query.set("cursor", cursor);
      const value = await clockifyRequest<any>(`/api/clockify/v2/audit?${query}`);
      setData((old: any) => cursor ? { ...value, entries: [...old.entries, ...value.entries] } : value);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore di caricamento");
    } finally {
      setLoading(false);
    }
  }, [anomaly, appliedParams]);
  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
        <div><CardTitle>Audit rendicontazione</CardTitle><p className="mt-1 text-sm text-muted-foreground">Anomalie rilevate nel perimetro e nei filtri applicati.</p></div>
        <Select value={anomaly} onValueChange={setAnomaly}><SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent>{choices.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </CardHeader>
      <CardContent className="p-0">
        {error && <p role="alert" className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="overflow-x-auto">
          <Table className="min-w-[850px]">
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Utente</TableHead><TableHead>Progetto</TableHead><TableHead className="text-right">Durata</TableHead><TableHead>Anomalie</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data.entries || []).map((entry: any) => (
                <TableRow key={entry.id}>
                  <TableCell className="py-4 capitalize">{formatClockifyDay(clockifyRomeDate(entry.workDate), "short")}</TableCell>
                  <TableCell className="py-4"><p className="font-medium">{entry.user?.name || entry.user?.email}</p><p className="text-xs text-muted-foreground">{entry.user?.department || "—"}</p></TableCell>
                  <TableCell className="py-4">{entry.project ? <><p className="font-medium">{entry.project.name}</p><p className="text-xs text-muted-foreground">{entry.project.client || "Senza cliente"}</p></> : "—"}</TableCell>
                  <TableCell className="py-4 text-right font-semibold tabular-nums">{formatClockifyDuration(entry.durationMin)}</TableCell>
                  <TableCell className="py-4"><div className="flex flex-wrap gap-1.5">{entry.reasons.map((reason: string) => <span key={reason} className="inline-flex items-center gap-1 rounded-full border border-warning/50 bg-warning/10 px-2 py-1 text-xs"><AlertTriangle className="h-3 w-3" />{labels[reason] || reason}</span>)}</div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(data.entries || []).length === 0 && !loading && <p className="px-6 py-12 text-center text-sm text-muted-foreground">Nessuna anomalia corrisponde ai filtri applicati.</p>}
        {data.nextCursor && <div className="border-t p-4 text-center"><Button variant="outline" disabled={loading} onClick={() => void load(data.nextCursor)}>{loading ? "Caricamento…" : "Carica altre anomalie"}</Button></div>}
      </CardContent>
    </Card>
  );
}

export default function ClockifyAuditClient(): JSX.Element {
  return <main className="min-h-screen bg-secondary/40"><div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8"><div><h1 className="text-2xl font-bold">Audit rendicontazione</h1><p className="text-sm text-muted-foreground">Sola lettura: anomalie e contesto necessario per correggerle.</p></div><ClockifyAuditPanel /></div></main>;
}
