"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Filter, Printer, RotateCcw, Share2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClockifyAuditPanel } from "../audit/clockify-audit-client";
import { clockifyRomeDate } from "../clockify-v2-format";
import { clockifyRequest } from "../clockify-v2-request";
import { ClockifyFilterCombobox, type ClockifyFilterOption } from "./clockify-filter-combobox";
import { ClockifyReportView } from "./clockify-report-view";

type ReportType = "summary" | "detailed" | "weekly";
type Tab = ReportType | "audit" | "shared";
type Filters = { from: string; to: string; department: string; userId: string; client: string; projectId: string; taskId: string; tag: string; locked: string; description: string; billable: string };
type Settings = { filters: Filters; groupBy: string; increment: string; mode: string; granularity: string };
type Catalog = {
  departments: string[];
  users: Array<{ id: string; name: string | null; email: string; department: string | null }>;
  clients: Array<{ id: string | null; name: string }>;
  projects: Array<{ id: string; name: string; client: string; color: string; archived: boolean }>;
  tasks: Array<{ id: string; name: string; projectId: string; active: boolean }>;
  tags: string[];
};

function initialSettings(): Settings {
  const today = clockifyRomeDate(new Date());
  return {
    filters: { from: `${today.slice(0, 7)}-01`, to: today, department: "", userId: "", client: "", projectId: "", taskId: "", tag: "", locked: "", description: "", billable: "" },
    groupBy: "project",
    increment: "",
    mode: "nearest",
    granularity: "",
  };
}
function query(settings: Settings, type: ReportType): string {
  return new URLSearchParams({
    ...Object.fromEntries(Object.entries(settings.filters).filter(([, value]) => value !== "")),
    reportType: type,
    ...(settings.groupBy ? { groupBy: settings.groupBy } : {}),
    ...(settings.granularity ? { granularity: settings.granularity } : {}),
    ...(settings.increment ? { roundingIncrement: settings.increment, roundingMode: settings.mode } : {}),
  }).toString();
}

export default function ClockifyReportsClient(): JSX.Element {
  const [tab, setTab] = useState<Tab>("summary");
  const [draft, setDraft] = useState<Settings>(initialSettings);
  const [applied, setApplied] = useState<Settings>(initialSettings);
  const [catalog, setCatalog] = useState<Catalog>({ departments: [], users: [], clients: [], projects: [], tasks: [], tags: [] });
  const [report, setReport] = useState<any>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const reportType: ReportType = tab === "detailed" || tab === "weekly" ? tab : "summary";
  const params = useMemo(() => query(applied, reportType), [applied, reportType]);

  useEffect(() => {
    void clockifyRequest<Catalog>("/api/clockify/v2/reports/catalog").then(setCatalog).catch((cause) => setError(cause instanceof Error ? cause.message : "Impossibile caricare i filtri"));
  }, []);
  const load = useCallback(async () => {
    if (tab === "audit") return;
    setLoading(true);
    setError("");
    try {
      if (tab === "shared") {
        const value = await clockifyRequest<{ shares: any[] }>("/api/clockify/v2/reports/shares");
        setShares(value.shares || []);
      } else {
        setReport(await clockifyRequest(`/api/clockify/v2/reports?${params}`));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore di caricamento");
    } finally {
      setLoading(false);
    }
  }, [params, tab]);
  useEffect(() => { void load(); }, [load]);

  function changeFilter(name: keyof Filters, value: string): void {
    setDraft((current) => ({ ...current, filters: { ...current.filters, [name]: value } }));
  }
  function applyFilters(): void {
    setApplied({ ...draft, filters: { ...draft.filters } });
  }
  function resetFilters(): void {
    const next = initialSettings();
    setDraft(next);
    setApplied(next);
  }
  function preset(kind: "week" | "month" | "year"): void {
    const today = clockifyRomeDate(new Date());
    const date = new Date(`${today}T12:00:00Z`);
    let from = `${today.slice(0, 7)}-01`;
    if (kind === "week") {
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      from = date.toISOString().slice(0, 10);
    }
    if (kind === "year") from = `${today.slice(0, 4)}-01-01`;
    setDraft((current) => ({ ...current, filters: { ...current.filters, from, to: today } }));
  }
  async function createShare(): Promise<void> {
    try {
      const value = await clockifyRequest<{ token: string }>("/api/clockify/v2/reports/shares", {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(Object.entries(applied.filters).filter(([, value]) => value !== "")),
          reportType,
          groupBy: applied.groupBy || undefined,
          granularity: applied.granularity || undefined,
          roundingIncrement: applied.increment || undefined,
          roundingMode: applied.increment ? applied.mode : undefined,
        }),
      });
      const url = `${window.location.origin}/clockify/shared/${value.token}`;
      setShareUrl(url);
      await navigator.clipboard?.writeText(url);
      toast.success("Link creato e copiato");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile creare la condivisione");
    }
  }
  async function revoke(id: string): Promise<void> {
    try {
      await clockifyRequest(`/api/clockify/v2/reports/shares/${id}/revoke`, { method: "POST" });
      toast.success("Condivisione revocata");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile revocare");
    }
  }
  async function loadMore(): Promise<void> {
    if (!report?.nextCursor) return;
    setLoading(true);
    try {
      const next: any = await clockifyRequest(`/api/clockify/v2/reports?${params}&cursor=${encodeURIComponent(report.nextCursor)}&limit=100`);
      setReport((current: any) => ({
        ...next,
        rows: current.type === "detailed" ? [...current.rows, ...next.rows] : current.rows,
        people: current.type === "weekly" ? [...current.people, ...next.people] : current.people,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore di caricamento");
    } finally {
      setLoading(false);
    }
  }

  const userOptions: ClockifyFilterOption[] = catalog.users.map((user) => ({ value: user.id, label: user.name || user.email, description: user.department || user.email }));
  const projectOptions: ClockifyFilterOption[] = catalog.projects.map((project) => ({ value: project.id, label: project.name, description: `${project.client}${project.archived ? " · archiviato" : ""}`, color: project.color }));
  const taskOptions: ClockifyFilterOption[] = catalog.tasks.filter((task) => !draft.filters.projectId || task.projectId === draft.filters.projectId).map((task) => ({ value: task.id, label: task.name, description: task.active ? undefined : "Disattivata" }));

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="report-page mx-auto max-w-[1500px] space-y-5 px-3 py-5 sm:px-6 sm:py-7">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h1 className="text-2xl font-bold sm:text-3xl">Report Clockify</h1><p className="mt-1 text-sm text-muted-foreground">Dati live, calcolati lato server e limitati al tuo perimetro.</p></div>
          <div className="report-no-print flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/clockify">Timesheet</Link></Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Stampa</Button>
            {tab !== "shared" && tab !== "audit" && <Button asChild variant="outline"><a href={`/api/clockify/v2/reports/export?${params}`}><Download className="mr-2 h-4 w-4" />CSV</a></Button>}
          </div>
        </header>
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="report-no-print h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="summary">Riepilogo</TabsTrigger><TabsTrigger value="detailed">Dettaglio</TabsTrigger><TabsTrigger value="weekly">Settimanale</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger><TabsTrigger value="shared">Condivisi</TabsTrigger>
          </TabsList>
          {tab !== "shared" && (
            <Card className="report-no-print mt-4">
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4" />Filtri</span>
                  <Button size="sm" variant="outline" onClick={() => preset("week")}>Questa settimana</Button>
                  <Button size="sm" variant="outline" onClick={() => preset("month")}>Questo mese</Button>
                  <Button size="sm" variant="outline" onClick={() => preset("year")}>Quest’anno</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                  <Field label="Da"><Input type="date" value={draft.filters.from} onChange={(event) => changeFilter("from", event.target.value)} /></Field>
                  <Field label="A"><Input type="date" value={draft.filters.to} onChange={(event) => changeFilter("to", event.target.value)} /></Field>
                  <Field label="Reparto"><ClockifyFilterCombobox value={draft.filters.department} placeholder="Reparto" options={catalog.departments.map((value) => ({ value, label: value }))} onChange={(value) => changeFilter("department", value)} /></Field>
                  <Field label="Utente"><ClockifyFilterCombobox value={draft.filters.userId} placeholder="Utente" options={userOptions} onChange={(value) => changeFilter("userId", value)} /></Field>
                  <Field label="Cliente"><ClockifyFilterCombobox value={draft.filters.client} placeholder="Cliente" options={catalog.clients.map((client) => ({ value: client.name, label: client.name }))} onChange={(value) => changeFilter("client", value)} /></Field>
                  <Field label="Progetto"><ClockifyFilterCombobox value={draft.filters.projectId} placeholder="Progetto" options={projectOptions} onChange={(value) => { changeFilter("projectId", value); changeFilter("taskId", ""); }} /></Field>
                  <Field label="Task"><ClockifyFilterCombobox value={draft.filters.taskId} placeholder="Task" options={taskOptions} onChange={(value) => changeFilter("taskId", value)} /></Field>
                  <Field label="Tag"><ClockifyFilterCombobox value={draft.filters.tag} placeholder="Tag" options={catalog.tags.map((value) => ({ value, label: value }))} onChange={(value) => changeFilter("tag", value)} /></Field>
                  <Field label="Descrizione"><Input value={draft.filters.description} onChange={(event) => changeFilter("description", event.target.value)} placeholder="Contiene…" /></Field>
                  <Field label="Stato blocco"><Choice value={draft.filters.locked || "all"} onChange={(value) => changeFilter("locked", value === "all" ? "" : value)} options={[["all", "Tutti"], ["true", "Bloccati"], ["false", "Non bloccati"]]} /></Field>
                  <Field label="Fatturabile"><Choice value={draft.filters.billable || "all"} onChange={(value) => changeFilter("billable", value === "all" ? "" : value)} options={[["all", "Tutti"], ["true", "Sì"], ["false", "No"]]} /></Field>
                  <Field label="Raggruppa"><Choice value={draft.groupBy || "none"} onChange={(value) => setDraft((current) => ({ ...current, groupBy: value === "none" ? "" : value }))} options={[["none", "Nessuno"], ["client", "Cliente"], ["project", "Progetto"], ["description", "Descrizione"], ["task", "Task"], ["tag", "Tag"], ["user", "Utente"]]} /></Field>
                  <Field label="Granularità"><Choice value={draft.granularity || "auto"} onChange={(value) => setDraft((current) => ({ ...current, granularity: value === "auto" ? "" : value }))} options={[["auto", "Automatica"], ["day", "Giorno"], ["week", "Settimana"], ["month", "Mese"]]} /></Field>
                  <Field label="Arrotondamento"><Choice value={draft.increment || "none"} onChange={(value) => setDraft((current) => ({ ...current, increment: value === "none" ? "" : value }))} options={[["none", "Nessuno"], ["5", "5 minuti"], ["10", "10 minuti"], ["15", "15 minuti"], ["30", "30 minuti"]]} /></Field>
                  {draft.increment && <Field label="Modalità"><Choice value={draft.mode} onChange={(mode) => setDraft((current) => ({ ...current, mode }))} options={[["nearest", "Più vicino"], ["up", "Per eccesso"], ["down", "Per difetto"]]} /></Field>}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={resetFilters}><RotateCcw className="mr-2 h-4 w-4" />Azzera</Button>
                  {tab !== "audit" && <Button variant="outline" onClick={() => void createShare()}><Share2 className="mr-2 h-4 w-4" />Condividi</Button>}
                  <Button onClick={applyFilters} disabled={loading}>{loading ? "Caricamento…" : "Applica filtri"}</Button>
                </div>
              </CardContent>
            </Card>
          )}
          {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <TabsContent value="summary" className="mt-4"><ClockifyReportView report={report} loading={loading} /></TabsContent>
          <TabsContent value="detailed" className="mt-4"><ClockifyReportView report={report} loading={loading} onLoadMore={loadMore} /></TabsContent>
          <TabsContent value="weekly" className="mt-4"><ClockifyReportView report={report} loading={loading} onLoadMore={loadMore} /></TabsContent>
          <TabsContent value="audit" className="mt-4"><ClockifyAuditPanel appliedParams={params} /></TabsContent>
          <TabsContent value="shared" className="mt-4"><Shares shares={shares} shareUrl={shareUrl} onRevoke={revoke} /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Choice({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }): JSX.Element { return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([option, label]) => <SelectItem key={option} value={option}>{label}</SelectItem>)}</SelectContent></Select>; }
function Shares({ shares, shareUrl, onRevoke }: { shares: any[]; shareUrl: string; onRevoke: (id: string) => Promise<void> }): JSX.Element {
  return <Card><CardContent className="space-y-4 pt-6">{shareUrl && <div className="rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="font-medium">Link creato</p><a className="mt-1 block break-all text-sm text-primary underline" href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a></div>}<p className="text-sm text-muted-foreground">I link sono live, in sola lettura e revocabili. Il perimetro dell’autore viene verificato a ogni apertura.</p>{shares.map((share) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4" key={share.id}><div><p className="font-medium">{share.reportType}</p><p className="text-sm text-muted-foreground">{new Date(share.createdAt).toLocaleString("it-IT")}{share.revokedAt ? " · revocata" : ""}</p></div>{!share.revokedAt && <Button variant="outline" size="sm" onClick={() => void onRevoke(share.id)}>Revoca</Button>}</div>)}{shares.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nessuna condivisione.</p>}</CardContent></Card>;
}
