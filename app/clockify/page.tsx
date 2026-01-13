"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { CalendarIcon, Download, Loader2, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { buildDelimitedText, downloadCsvFile, safeFileStem } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type ClockifyProjectLite = { id: string; name: string; client: string };
type ClockifyUserLite = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
};

type ClockifyEntryItem = {
  id: string;
  description: string;
  task: string | null;
  tags: string[];
  billable: boolean;
  startAt: string;
  endAt: string;
  durationMin: number;
  user: ClockifyUserLite;
  project: ClockifyProjectLite;
};

function initials(name?: string | null, email?: string | null): string {
  const raw = (name || email || "U").trim();
  const parts = raw.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "U") + (parts[1]?.[0] || "")).toUpperCase();
}

function displayName(u: ClockifyUserLite): string {
  const full = (u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim()).trim();
  return full || u.email;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHm(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

function buildDateTime(day: Date, time: string): Date | null {
  const [hRaw, mRaw] = String(time || "").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function ClockifyPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  const globalRole = String((session?.user as any)?.role || "member");
  const canPickUser = globalRole === "admin" || globalRole === "manager";

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");

  const [projects, setProjects] = useState<ClockifyProjectLite[]>([]);
  const [users, setUsers] = useState<ClockifyUserLite[]>([]);
  const [entries, setEntries] = useState<ClockifyEntryItem[]>([]);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");
  const [formTask, setFormTask] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formBillable, setFormBillable] = useState(false);
  const [formTags, setFormTags] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const loadMeta = async () => {
    setLoadingMeta(true);
    try {
      const [pRes, uRes] = await Promise.all([
        fetch("/api/clockify/projects", { cache: "no-store" }),
        fetch("/api/clockify/users", { cache: "no-store" }),
      ]);
      const pData = await pRes.json();
      const uData = await uRes.json();
      if (!pRes.ok) throw new Error(pData?.error || "Errore caricamento progetti");
      if (!uRes.ok) throw new Error(uData?.error || "Errore caricamento utenti");

      const nextProjects = Array.isArray(pData?.projects) ? (pData.projects as ClockifyProjectLite[]) : [];
      const nextUsers = Array.isArray(uData?.users) ? (uData.users as ClockifyUserLite[]) : [];
      setProjects(nextProjects);
      setUsers(nextUsers);

      if (!formProjectId && nextProjects[0]?.id) setFormProjectId(nextProjects[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento dati");
    } finally {
      setLoadingMeta(false);
    }
  };

  const loadEntries = async () => {
    setLoadingEntries(true);
    try {
      const sp = new URLSearchParams();
      sp.set("date", isoDay(selectedDate));
      if (q.trim()) sp.set("q", q.trim());
      if (projectId !== "all") sp.set("projectId", projectId);
      if (canPickUser && userId !== "all") sp.set("userId", userId);

      const res = await fetch(`/api/clockify/entries?${sp.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore caricamento report");
      setEntries(Array.isArray(data?.entries) ? (data.entries as ClockifyEntryItem[]) : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento report");
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const t = setTimeout(() => void loadEntries(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedDate, q, projectId, userId, canPickUser]);

  const summary = useMemo(() => {
    const totalMin = entries.reduce((acc, e) => acc + (Number.isFinite(e.durationMin) ? e.durationMin : 0), 0);
    const billableMin = entries.reduce((acc, e) => acc + (e.billable ? (e.durationMin || 0) : 0), 0);
    const projectsCount = new Set(entries.map((e) => e.project?.id).filter(Boolean)).size;
    return {
      entries: entries.length,
      totalMin,
      billableMin,
      projectsCount,
    };
  }, [entries]);

  const onExportCsv = () => {
    const header = ["Date", "Project", "Client", "Description", "Task", "User", "Start", "End", "Duration (h)", "Billable", "Tags"];
    const rows = entries.map((e) => {
      const start = new Date(e.startAt);
      const end = new Date(e.endAt);
      return [
        isoDay(selectedDate),
        e.project?.name || "",
        e.project?.client || "",
        e.description || "",
        e.task || "",
        displayName(e.user),
        Number.isNaN(start.getTime()) ? "" : start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        Number.isNaN(end.getTime()) ? "" : end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        formatHm(e.durationMin),
        e.billable ? "Yes" : "No",
        Array.isArray(e.tags) ? e.tags.join(", ") : "",
      ];
    });

    const csv = buildDelimitedText({ header, rows, delimiter: ",", includeBom: true });
    downloadCsvFile(`clockify_${safeFileStem(isoDay(selectedDate))}.csv`, csv);
  };

  const onCreate = async () => {
    if (!formProjectId) {
      toast.error("Seleziona un progetto");
      return;
    }
    if (!formDescription.trim()) {
      toast.error("Inserisci una descrizione");
      return;
    }
    const startAt = buildDateTime(selectedDate, formStartTime);
    const endAt = buildDateTime(selectedDate, formEndTime);
    if (!startAt || !endAt) {
      toast.error("Orario non valido");
      return;
    }
    if (endAt.getTime() <= startAt.getTime()) {
      toast.error("L'orario di fine deve essere dopo l'inizio");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/clockify/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: formProjectId,
          description: formDescription.trim(),
          task: formTask.trim() || null,
          tags: formTags,
          billable: formBillable,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Creazione fallita");

      toast.success("Entry creata");
      setCreateOpen(false);
      setFormDescription("");
      setFormTask("");
      setFormTags("");
      setFormBillable(false);
      await loadEntries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore creazione");
    } finally {
      setCreating(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground mb-1">Time Tracking</h1>
            <p className="text-sm text-muted-foreground">
              Report giornaliero delle attività. Member vedono solo le proprie entry, i manager il proprio reparto.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onExportCsv}
              disabled={loadingEntries || entries.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova entry
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Nuova entry</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Progetto</div>
                    <Select value={formProjectId} onValueChange={setFormProjectId} disabled={loadingMeta || projects.length === 0}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={loadingMeta ? "Caricamento..." : "Seleziona un progetto"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.client ? ` — ${p.client}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {projects.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Nessun progetto Clockify configurato. Un admin può importarli via script.
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Descrizione</div>
                    <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Task (opzionale)</div>
                      <Input value={formTask} onChange={(e) => setFormTask(e.target.value)} placeholder="Es. Check posts" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Tags (comma-separated)</div>
                      <Input value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="Es. Social, Content" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Inizio</div>
                      <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Fine</div>
                      <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Billable</div>
                      <div className="text-xs text-muted-foreground">Segna l’attività come fatturabile.</div>
                    </div>
                    <Switch checked={formBillable} onCheckedChange={setFormBillable} />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                    Annulla
                  </Button>
                  <Button onClick={onCreate} disabled={creating || projects.length === 0}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Crea
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Totale ore</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatHm(summary.totalMin)}</div>
              <div className="text-xs text-muted-foreground">Giorno selezionato</div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Billable hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatHm(summary.billableMin)}</div>
              <div className="text-xs text-muted-foreground">Fatturabili</div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Active projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.projectsCount}</div>
              <div className="text-xs text-muted-foreground">Con entry nel giorno</div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.entries}</div>
              <div className="text-xs text-muted-foreground">Totale registrazioni</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 bg-card/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="w-full sm:w-72">
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca…" />
                </div>

                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full sm:w-60">
                    <SelectValue placeholder={loadingMeta ? "Caricamento..." : "Tutti i progetti"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i progetti</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {canPickUser ? (
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger className="w-full sm:w-60">
                      <SelectValue placeholder={loadingMeta ? "Caricamento..." : "Tutti gli utenti"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {displayName(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              <div className="w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full sm:w-[200px] justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate.toLocaleDateString("it-IT", { year: "numeric", month: "short", day: "2-digit" })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => {
                        if (d) setSelectedDate(d);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingEntries ? (
              <div className="py-10 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Caricamento…
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Nessuna entry per i filtri selezionati.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="whitespace-nowrap">Time range</TableHead>
                      <TableHead className="whitespace-nowrap">Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => {
                      const start = new Date(e.startAt);
                      const end = new Date(e.endAt);
                      const timeRange =
                        Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
                          ? ""
                          : `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

                      return (
                        <TableRow key={e.id} className="hover:bg-muted/50">
                          <TableCell className="min-w-[220px]">
                            <div className="font-medium">{e.project?.name || ""}</div>
                            {e.project?.client ? (
                              <div className="text-xs text-muted-foreground">{e.project.client}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="min-w-[320px]">
                            <div className="font-medium">{e.description}</div>
                            {e.task ? <div className="text-xs text-muted-foreground">{e.task}</div> : null}
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary text-white text-[10px]">
                                  {initials(displayName(e.user), e.user.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{displayName(e.user)}</div>
                                {e.user.department ? (
                                  <div className="text-xs text-muted-foreground truncate">{e.user.department}</div>
                                ) : (
                                  <div className="text-xs text-muted-foreground truncate">{e.user.email}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{timeRange}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono">{formatHm(e.durationMin)}</TableCell>
                          <TableCell>
                            <Badge variant={e.billable ? "default" : "secondary"}>
                              {e.billable ? "Billable" : "Non billable"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

