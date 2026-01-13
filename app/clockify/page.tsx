"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { CalendarIcon, ChevronLeft, ChevronRight, Download, Loader2, Plus } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday=0 ... Sunday=6
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(base: Date): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(base: Date): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
  const meId = String((session?.user as any)?.id || "");

  const [view, setView] = useState<"day" | "week" | "month">("day");
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

  // In calendar views, require a single user (auto-fallback to me when possible)
  useEffect(() => {
    if (!canPickUser) return;
    if (view === "day") return;
    if (userId !== "all") return;
    if (!meId) return;
    setUserId(meId);
  }, [canPickUser, meId, userId, view]);

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
      const weekStart = startOfWeekMonday(selectedDate);
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      const isCalendarView = view !== "day";
      const requiresSingleUser = canPickUser && isCalendarView;
      if (requiresSingleUser && userId === "all") {
        setEntries([]);
        setLoadingEntries(false);
        return;
      }

      if (view === "day") {
        sp.set("date", isoDay(selectedDate));
      } else if (view === "week") {
        sp.set("from", isoDay(weekStart));
        sp.set("to", isoDay(addDays(weekStart, 6)));
      } else {
        sp.set("from", isoDay(monthStart));
        sp.set("to", isoDay(monthEnd));
      }

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
  }, [status, selectedDate, q, projectId, userId, canPickUser, view]);

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
    const header = [
      "Date",
      "Project",
      "Client",
      "Description",
      "Task",
      "User",
      "Start",
      "End",
      "Duration (h)",
      "Billable",
      "Tags",
    ];
    const rows = entries.map((e) => {
      const start = new Date(e.startAt);
      const end = new Date(e.endAt);
      return [
        Number.isNaN(start.getTime()) ? "" : isoDay(start),
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
    downloadCsvFile(`clockify_${safeFileStem(view)}_${safeFileStem(isoDay(selectedDate))}.csv`, csv);
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

  const weekStart = startOfWeekMonday(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const rangeLabel =
    view === "day"
      ? selectedDate.toLocaleDateString("it-IT", { year: "numeric", month: "short", day: "2-digit" })
      : view === "week"
        ? `${weekStart.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} – ${weekEnd.toLocaleDateString(
            "it-IT",
            { day: "2-digit", month: "short", year: "numeric" }
          )}`
        : `${monthStart.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}`;

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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="day" className="flex-1 sm:flex-none">
                Giorno
              </TabsTrigger>
              <TabsTrigger value="week" className="flex-1 sm:flex-none">
                Settimana
              </TabsTrigger>
              <TabsTrigger value="month" className="flex-1 sm:flex-none">
                Mese
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous"
              onClick={() => setSelectedDate((d) => (view === "month" ? addDays(startOfMonth(d), -1) : addDays(d, view === "week" ? -7 : -1)))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {rangeLabel}
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
            <Button
              variant="outline"
              size="icon"
              aria-label="Next"
              onClick={() =>
                setSelectedDate((d) => (view === "month" ? addDays(endOfMonth(d), 1) : addDays(d, view === "week" ? 7 : 1)))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Totale ore</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatHm(summary.totalMin)}</div>
              <div className="text-xs text-muted-foreground">
                {view === "day" ? "Giorno selezionato" : view === "week" ? "Settimana selezionata" : "Mese selezionato"}
              </div>
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
                      <SelectValue placeholder={loadingMeta ? "Caricamento..." : view === "day" ? "Tutti gli utenti" : "Seleziona un utente"} />
                    </SelectTrigger>
                    <SelectContent>
                      {view === "day" ? <SelectItem value="all">Tutti</SelectItem> : null}
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {displayName(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingEntries ? (
              <div className="py-10 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Caricamento…
              </div>
            ) : view !== "day" && canPickUser && userId === "all" ? (
              <div className="p-6 text-sm text-muted-foreground">
                Per la vista calendario seleziona un singolo utente.
              </div>
            ) : view === "day" ? (
              entries.length === 0 ? (
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
                            : `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" }
                              )}`;

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
              )
            ) : view === "week" ? (
              <WeekView entries={entries} anchor={selectedDate} />
            ) : (
              <MonthView
                entries={entries}
                anchor={selectedDate}
                selectedDate={selectedDate}
                onPickDay={(d) => {
                  setSelectedDate(d);
                  setView("day");
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WeekView({ entries, anchor }: { entries: ClockifyEntryItem[]; anchor: Date }) {
  const weekStart = startOfWeekMonday(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byDay = useMemo(() => {
    const m = new Map<string, ClockifyEntryItem[]>();
    for (const e of entries) {
      const d = new Date(e.startAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = isoDay(d);
      const list = m.get(key) ?? [];
      list.push(e);
      m.set(key, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
    return m;
  }, [entries]);

  const hours = useMemo(() => {
    let minHour = 7;
    let maxHour = 20;
    for (const e of entries) {
      const s = new Date(e.startAt);
      const en = new Date(e.endAt);
      if (Number.isNaN(s.getTime()) || Number.isNaN(en.getTime())) continue;
      minHour = Math.min(minHour, s.getHours());
      maxHour = Math.max(maxHour, en.getHours() + 1);
    }
    minHour = Math.max(0, Math.min(minHour, 22));
    maxHour = Math.max(minHour + 1, Math.min(maxHour, 24));
    return Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  }, [entries]);

  const pxPerHour = 56;

  type Placed = { entry: ClockifyEntryItem; lane: number; lanes: number; startMin: number; endMin: number };
  const placedByDay = useMemo(() => {
    const out = new Map<string, Placed[]>();
    for (const day of days) {
      const key = isoDay(day);
      const list = byDay.get(key) ?? [];
      const lanes: number[] = [];
      const placed: Placed[] = [];
      for (const e of list) {
        const s = new Date(e.startAt);
        const en = new Date(e.endAt);
        const startMin = s.getHours() * 60 + s.getMinutes();
        const endMin = en.getHours() * 60 + en.getMinutes();
        const startMs = s.getTime();
        const endMs = en.getTime();
        let lane = lanes.findIndex((laneEndMs) => startMs >= laneEndMs);
        if (lane === -1) {
          lane = lanes.length;
          lanes.push(endMs);
        } else {
          lanes[lane] = endMs;
        }
        placed.push({ entry: e, lane, lanes: 0, startMin, endMin });
      }
      const lanesCount = Math.max(1, lanes.length);
      out.set(
        key,
        placed.map((p) => ({ ...p, lanes: lanesCount }))
      );
    }
    return out;
  }, [byDay, days]);

  const minHour = hours[0] ?? 0;
  const maxHour = (hours[hours.length - 1] ?? minHour) + 1;
  const height = (maxHour - minHour) * pxPerHour;

  return (
    <div className="p-4">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-0">
        <div />
        {days.map((d) => (
          <div key={isoDay(d)} className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            {d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" })}
          </div>
        ))}
        <div className="col-span-8 border-t border-border/60" />
      </div>

      <div className="max-h-[70vh] overflow-auto border rounded-md">
        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-0">
          <div className="bg-background">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: pxPerHour }}
                className="pr-2 text-[10px] text-muted-foreground flex items-start justify-end pt-1 border-b border-border/40"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = isoDay(day);
            const placed = placedByDay.get(key) ?? [];
            return (
              <div key={key} className="relative bg-background border-l border-border/40" style={{ height }}>
                {hours.map((h) => (
                  <div key={h} style={{ height: pxPerHour }} className="border-b border-border/40" />
                ))}
                {placed.map((p) => {
                  const top = ((p.startMin - minHour * 60) / 60) * pxPerHour;
                  const bottom = ((p.endMin - minHour * 60) / 60) * pxPerHour;
                  const blockH = Math.max(24, bottom - top);
                  const widthPct = 100 / p.lanes;
                  const leftPct = (p.lane * 100) / p.lanes;
                  return (
                    <div
                      key={p.entry.id}
                      style={{
                        top,
                        height: blockH,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        paddingLeft: 6,
                        paddingRight: 6,
                      }}
                      className="absolute z-10"
                    >
                      <div className="h-full rounded-md border border-border/60 bg-muted/60 hover:bg-muted/80 transition-colors shadow-sm overflow-hidden">
                        <div className="p-2">
                          <div className="text-[11px] font-semibold truncate">{p.entry.project?.name || ""}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-2">{p.entry.description}</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground">{formatHm(p.entry.durationMin)}</span>
                            <Badge variant={p.entry.billable ? "default" : "secondary"} className="h-5 text-[10px] px-1.5">
                              {p.entry.billable ? "B" : "NB"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthView({
  entries,
  anchor,
  selectedDate,
  onPickDay,
}: {
  entries: ClockifyEntryItem[];
  anchor: Date;
  selectedDate: Date;
  onPickDay: (d: Date) => void;
}) {
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const gridStart = startOfWeekMonday(first);
  const gridEnd = addDays(startOfWeekMonday(last), 6);

  const days: Date[] = [];
  for (let d = new Date(gridStart); d.getTime() <= gridEnd.getTime(); d = addDays(d, 1)) {
    days.push(new Date(d));
  }

  const totals = useMemo(() => {
    const m = new Map<string, { minutes: number; entries: number }>();
    for (const e of entries) {
      const s = new Date(e.startAt);
      if (Number.isNaN(s.getTime())) continue;
      const key = isoDay(s);
      const prev = m.get(key) ?? { minutes: 0, entries: 0 };
      m.set(key, { minutes: prev.minutes + (e.durationMin || 0), entries: prev.entries + 1 });
    }
    return m;
  }, [entries]);

  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground mb-2">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d} className="px-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        {weeks.map((w, idx) => (
          <div key={idx} className="grid grid-cols-7 gap-2">
            {w.map((d) => {
              const inMonth = d.getMonth() === first.getMonth();
              const key = isoDay(d);
              const t = totals.get(key);
              const isSelected = sameDay(d, selectedDate);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPickDay(d)}
                  className={cn(
                    "rounded-md border p-2 text-left transition-colors min-h-[72px]",
                    inMonth ? "bg-background hover:bg-accent/50" : "bg-muted/30 text-muted-foreground hover:bg-muted/40",
                    isSelected ? "ring-2 ring-primary" : "border-border/60"
                  )}
                >
                  <div className="text-xs font-medium">{d.getDate()}</div>
                  {t ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      <div className="font-mono">{formatHm(t.minutes)}</div>
                      <div>{t.entries} entry</div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-muted-foreground">—</div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

