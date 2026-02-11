"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  Shield,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Briefcase,
  CreditCard,
  Monitor,
  Lock,
  FileText,
  Calendar as CalendarIcon,
  Download
} from "lucide-react";
import { toast } from "react-hot-toast";
import { buildDelimitedText, downloadCsvFile, isoDate } from "@/lib/export";
import { getAbsenceTypeLabel } from "@/lib/absence-labels";

type AbsenceStatus = "pending" | "approved" | "rejected";

type AbsenceRow = {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  status: AbsenceStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

type Counts = { pending: number; approved: number; rejected: number; total: number };

function displayName(u: AbsenceRow["user"]): string {
  const name = (u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim()).trim();
  return name || u.email;
}

function formatDate(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString();
}

function formatDateTime(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString();
}

function statusBadge(status: AbsenceStatus): { label: string; className: string; icon: any } {
  if (status === "pending") return { label: "In Attesa", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: Clock };
  if (status === "approved") return { label: "Approvato", className: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2 };
  return { label: "Rifiutato", className: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle };
}

function getTypeIcon(type: string) {
  switch (type) {
    case "vacation":
    case "sick_leave":
    case "personal":
      return { icon: Briefcase, color: "text-blue-400" };
    case "late_entry":
    case "early_exit":
    case "overtime":
      return { icon: Clock, color: "text-orange-400" };
    case "transfer":
    case "remote":
      return { icon: Monitor, color: "text-purple-400" };
    default:
      return { icon: FileText, color: "text-gray-400" };
  }
}


type ConfirmMode = "row" | "selected" | "before" | "createdRange";

type ConfirmState =
  | { open: false }
  | {
      open: true;
      mode: ConfirmMode;
      title: string;
      description: string;
      payload: { ids?: string[]; before?: string; createdFrom?: string; createdTo?: string; rowId?: string };
    };

export default function AdminAbsencesArchivePage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  const role = (session?.user as any)?.role as string | undefined;
  const isAdmin = role === "admin";

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AbsenceStatus>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [take, setTake] = useState(50);
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [deleteBefore, setDeleteBefore] = useState("");
  const [deleteRangeFrom, setDeleteRangeFrom] = useState("");
  const [deleteRangeTo, setDeleteRangeTo] = useState("");

  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AbsenceRow | null>(null);
  const [editForm, setEditForm] = useState({
    type: "",
    startDate: "",
    endDate: "",
    isFullDay: true,
    reason: "",
    status: "pending" as AbsenceStatus,
  });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (typeFilter !== "all") sp.set("type", typeFilter);
    if (from) sp.set("from", new Date(from).toISOString());
    if (to) sp.set("to", new Date(to).toISOString());
    if (createdFrom) sp.set("createdFrom", new Date(createdFrom).toISOString());
    if (createdTo) sp.set("createdTo", new Date(createdTo).toISOString());
    sp.set("take", String(take));
    sp.set("skip", String(page * take));
    sp.set("includeCounts", "true");
    return sp.toString();
  }, [q, statusFilter, typeFilter, from, to, createdFrom, createdTo, take, page]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/absences?${queryString}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore caricamento archivio");
      setRows(Array.isArray(data.absences) ? data.absences : []);
      setTotal(Number(data.total || 0));
      setCounts(data.counts || null);
      setSelectedIds([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento archivio");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const MAX_EXPORT = 5000;
    if (!total || total <= 0) {
      toast("Nessuna richiesta da esportare");
      return;
    }
    if (total > MAX_EXPORT) {
      toast.error(`Troppi record (${total}). Applica filtri e riprova.`);
      return;
    }

    setIsExporting(true);
    try {
      const base = new URLSearchParams();
      if (q.trim()) base.set("q", q.trim());
      if (statusFilter !== "all") base.set("status", statusFilter);
      if (typeFilter !== "all") base.set("type", typeFilter);
      if (from) base.set("from", new Date(from).toISOString());
      if (to) base.set("to", new Date(to).toISOString());
      if (createdFrom) base.set("createdFrom", new Date(createdFrom).toISOString());
      if (createdTo) base.set("createdTo", new Date(createdTo).toISOString());

      const take = 500;
      const pages = Math.ceil(total / take);
      const all: AbsenceRow[] = [];
      for (let i = 0; i < pages; i++) {
        const params = new URLSearchParams(base.toString());
        params.set("take", String(take));
        params.set("skip", String(i * take));
        params.set("includeCounts", "false");
        const res = await fetch(`/api/admin/absences?${params.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as any)?.error || "Export fallito");
        const chunk = Array.isArray((data as any)?.absences) ? ((data as any).absences as AbsenceRow[]) : [];
        all.push(...chunk);
      }

      const header = [
        "id",
        "user",
        "email",
        "type",
        "status",
        "startDate",
        "endDate",
        "isFullDay",
        "startTime",
        "endTime",
        "reason",
        "approvedBy",
        "approvedAt",
        "createdAt",
      ];

      const tableRows = all.map((r) => [
        r.id,
        displayName(r.user),
        r.user.email,
        getAbsenceTypeLabel(r.type),
        r.status,
        isoDate(r.startDate),
        isoDate(r.endDate),
        r.isFullDay ? "true" : "false",
        r.startTime || "",
        r.endTime || "",
        r.reason || "",
        r.approvedBy || "",
        r.approvedAt ? new Date(r.approvedAt).toISOString() : "",
        r.createdAt ? new Date(r.createdAt).toISOString() : "",
      ]);

      const stamp = new Date().toISOString().slice(0, 10);
      const csv = buildDelimitedText({ header, rows: tableRows });
      downloadCsvFile(`absences_archive_${stamp}.csv`, csv);
      toast.success("Export CSV pronto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export fallito");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!isAdmin) return;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin, queryString]);

  const toggleAllOnPage = (checked: boolean) => {
    if (!checked) return setSelectedIds([]);
    setSelectedIds(rows.map((r) => r.id));
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const openConfirm = async (next: Omit<Extract<ConfirmState, { open: true }>, "open">) => {
    setConfirm({ open: true, ...next });
    setConfirmCount(null);

    // Only bulk actions use dryRun
    const isBulk = next.mode !== "row";
    if (!isBulk) return;

    setConfirmLoading(true);
    try {
      const res = await fetch("/api/admin/absences/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next.payload, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Dry run fallito");
      setConfirmCount(Number(data.count || 0));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dry run fallito");
      setConfirm({ open: false });
    } finally {
      setConfirmLoading(false);
    }
  };

  const doDelete = async () => {
    if (!confirm.open) return;

    try {
      if (confirm.mode === "row" && confirm.payload.rowId) {
        const res = await fetch(`/api/admin/absences/${confirm.payload.rowId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Eliminazione fallita");
        toast.success("Eliminata");
        setConfirm({ open: false });
        await load();
        return;
      }

      // Bulk delete
      const res = await fetch("/api/admin/absences/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...confirm.payload, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Bulk delete fallito");
      toast.success(`Eliminate: ${data.deletedCount ?? 0}`);
      setConfirm({ open: false });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operazione fallita");
    }
  };

  // ---- Edit dialog handlers ----
  const openEditDialog = (row: AbsenceRow) => {
    setEditingRow(row);
    const sd = new Date(row.startDate);
    const ed = new Date(row.endDate);
    // Auto-correct 2-digit years (e.g. 0026 -> 2026) for display in the date picker
    const fixYear = (d: Date) => {
      if (d.getFullYear() < 100) d.setFullYear(d.getFullYear() + 2000);
      return d;
    };
    const fixedStart = fixYear(sd);
    const fixedEnd = fixYear(ed);
    setEditForm({
      type: row.type,
      startDate: fixedStart.toISOString().split("T")[0],
      endDate: fixedEnd.toISOString().split("T")[0],
      isFullDay: row.isFullDay,
      reason: row.reason || "",
      status: row.status,
    });
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingRow(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    if (!editForm.startDate || !editForm.endDate) {
      toast.error("Inserisci date di inizio e fine.");
      return;
    }

    const startYear = new Date(editForm.startDate).getFullYear();
    const endYear = new Date(editForm.endDate).getFullYear();
    if (startYear < 2000 || endYear < 2000) {
      toast.error("Anno non valido. Inserisci l'anno completo (es. 2026).");
      return;
    }
    if (new Date(editForm.startDate) > new Date(editForm.endDate)) {
      toast.error("La data di inizio deve essere precedente alla data di fine.");
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/absences/${editingRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editForm.type,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          isFullDay: editForm.isFullDay,
          reason: editForm.reason,
          status: editForm.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Modifica fallita");

      toast.success("Richiesta aggiornata con successo");
      closeEditDialog();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modifica fallita");
    } finally {
      setEditSaving(false);
    }
  };

  // Header replaced inline
  // const header removed

  if (status === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Accesso negato.</CardContent>
        </Card>
      </div>
    );
  }

  const allChecked = rows.length > 0 && selectedIds.length === rows.length;
  const anySelected = selectedIds.length > 0;
  const maxPage = Math.max(0, Math.ceil(total / take) - 1);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Header & Stats */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Archivio Richieste</h1>
            <p className="text-muted-foreground mt-1">
              Gestisci, analizza e pulisci lo storico delle approvazioni aziendali.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Shield className="w-24 h-24" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-muted-foreground">Totale Richieste</span>
                </div>
                <div className="text-3xl font-bold">{total}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Clock className="w-24 h-24" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-muted-foreground">In Attesa</span>
                </div>
                <div className="text-3xl font-bold text-yellow-500">{counts?.pending || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CheckCircle2 className="w-24 h-24" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-muted-foreground">Approvate</span>
                </div>
                <div className="text-3xl font-bold text-green-500">{counts?.approved || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <XCircle className="w-24 h-24" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-muted-foreground">Rifiutate</span>
                </div>
                <div className="text-3xl font-bold text-red-500">{counts?.rejected || 0}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-none shadow-none bg-transparent">
          <CardContent className="p-0 space-y-6">
            
            {/* Filters Bar */}
            <div className="p-4 rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm space-y-4">
              {/* Top Row: Search & Global Actions */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex-1 w-full md:w-auto relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)} 
                    placeholder="Cerca per utente, email o causale..." 
                    className="pl-9 bg-background/50 border-border/50 h-10 w-full"
                  />
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Button variant="outline" onClick={handleExport} className="h-10 gap-2" disabled={isExporting || total <= 0}>
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export CSV
                  </Button>
                  <Button variant="ghost" size="icon" onClick={load} className="h-10 w-10 border border-border/50">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Bottom Row: Detailed Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="bg-background/50 border-border/50 h-10 w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli status</SelectItem>
                    <SelectItem value="pending">In Attesa</SelectItem>
                    <SelectItem value="approved">Approvato</SelectItem>
                    <SelectItem value="rejected">Rifiutato</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-background/50 border-border/50 h-10 w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    <SelectItem value="vacation">Ferie</SelectItem>
                    <SelectItem value="sick_leave">Malattia</SelectItem>
                    <SelectItem value="personal">Permesso</SelectItem>
                  </SelectContent>
                </Select>

                <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                  <Input 
                    type="date" 
                    value={from} 
                    onChange={(e) => setFrom(e.target.value)} 
                    className="bg-background/50 border-border/50 h-10"
                    placeholder="Dal"
                  />
                  <Input 
                    type="date" 
                    value={to} 
                    onChange={(e) => setTo(e.target.value)} 
                    className="bg-background/50 border-border/50 h-10"
                    placeholder="Al"
                  />
                </div>

                <Select value={String(take)} onValueChange={(v) => setTake(Number(v))}>
                  <SelectTrigger className="bg-background/50 border-border/50 h-10 w-full">
                    <SelectValue placeholder="Per pagina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 per pagina</SelectItem>
                    <SelectItem value="50">50 per pagina</SelectItem>
                    <SelectItem value="100">100 per pagina</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  onClick={() => setPage(0)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white h-10 w-full"
                >
                  <Filter className="w-4 h-4 mr-2" /> Applica Filtri
                </Button>
              </div>
            </div>

            {/* Actions & Bulk */}
            <div className="flex items-center justify-between px-1">
              <div className="text-sm text-muted-foreground">
                {selectedIds.length > 0 ? (
                  <span className="text-primary font-medium">{selectedIds.length} righe selezionate</span>
                ) : (
                  <span>Totale: {total} risultati</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {anySelected && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      openConfirm({
                        mode: "selected",
                        title: "Elimina selezionate",
                        description: "Rimuovere le richieste selezionate?",
                        payload: { ids: selectedIds },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Elimina ({selectedIds.length})
                  </Button>
                )}
                
                <div className="flex items-center gap-2 bg-card/50 border rounded-lg p-1">
                  <Input
                    type="date"
                    value={deleteBefore}
                    onChange={(e) => setDeleteBefore(e.target.value)}
                    className="h-8 w-[130px] border-none bg-transparent"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                    disabled={!deleteBefore}
                    onClick={() =>
                      openConfirm({
                        mode: "before",
                        title: "Pulizia Archivio",
                        description: `Eliminare tutte le richieste antecedenti al ${deleteBefore}?`,
                        payload: { before: new Date(deleteBefore).toISOString() },
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    DryRun + Elimina
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>Caricamento archivio...</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b bg-muted/30">
                      <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[50px]">
                          <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAllOnPage(Boolean(v))} />
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">UTENTE</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">TIPO</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">PERIODO / CAUSALE</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">STATUS</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">AZIONI</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {rows.map((r) => {
                        const b = statusBadge(r.status);
                        const tInfo = getTypeIcon(r.type);
                        const TypeIcon = tInfo.icon;
                        const initial = (r.user.firstName?.[0] || r.user.email?.[0] || "U").toUpperCase();
                        
                        return (
                          <tr
                            key={r.id}
                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                          >
                            <td className="p-4 align-middle">
                              <Checkbox checked={selectedIds.includes(r.id)} onCheckedChange={(v) => toggleOne(r.id, Boolean(v))} />
                            </td>
                            <td className="p-4 align-middle">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border">
                                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                    {initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold text-foreground">{displayName(r.user)}</div>
                                  <div className="text-xs text-muted-foreground">{r.user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 align-middle">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-md bg-muted ${tInfo.color.replace('text-', 'bg-')}/10`}>
                                  <TypeIcon className={`w-4 h-4 ${tInfo.color}`} />
                                </div>
                                <span className="font-medium">{getAbsenceTypeLabel(r.type)}</span>
                              </div>
                            </td>
                            <td className="p-4 align-middle">
                              <div className="space-y-1">
                                <div className="font-semibold">
                                  {formatDate(r.startDate)} <span className="text-muted-foreground text-xs mx-1">➜</span> {formatDate(r.endDate)}
                                </div>
                                {r.reason && (
                                  <div className="text-xs text-muted-foreground max-w-[300px] truncate" title={r.reason}>
                                    {r.reason}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-4 align-middle">
                              <Badge variant="outline" className={`px-2 py-1 gap-1.5 ${b.className}`}>
                                <b.icon className="w-3.5 h-3.5" />
                                {b.label}
                              </Badge>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => openEditDialog(r)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() =>
                                    openConfirm({
                                      mode: "row",
                                      title: "Elimina richiesta",
                                      description: `Eliminare definitivamente la richiesta di ${displayName(r.user)}?`,
                                      payload: { rowId: r.id },
                                    })
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Nessuna richiesta trovata con i filtri correnti.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                Pagina {page + 1} di {maxPage + 1}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Precedente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= maxPage}
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                >
                  Successiva
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirm dialog */}
        <AlertDialog
          open={confirm.open}
          onOpenChange={(open) => {
            if (!open) setConfirm({ open: false });
          }}
        >
          <AlertDialogContent>
            {confirm.open ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {confirm.description}
                    {confirm.mode !== "row" ? (
                      <div className="mt-2 text-sm">
                        {confirmLoading ? (
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Calcolo elementi…
                          </span>
                        ) : (
                          <span>
                            Elementi da eliminare: <b>{confirmCount ?? "-"}</b>
                          </span>
                        )}
                      </div>
                    ) : null}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      doDelete();
                    }}
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={confirm.mode !== "row" && (confirmLoading || (confirmCount ?? 0) === 0)}
                  >
                    Conferma eliminazione
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : null}
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
          <DialogContent className="max-w-md">
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Modifica Richiesta</DialogTitle>
                <DialogDescription>
                  {editingRow ? `Modifica la richiesta di ${displayName(editingRow.user)}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-type">Tipo</Label>
                  <Select
                    value={editForm.type}
                    onValueChange={(v) => setEditForm({ ...editForm, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">Ferie</SelectItem>
                      <SelectItem value="sick_leave">Malattia</SelectItem>
                      <SelectItem value="personal">Permesso</SelectItem>
                      <SelectItem value="late_entry">Ingresso in ritardo</SelectItem>
                      <SelectItem value="early_exit">Uscita anticipata</SelectItem>
                      <SelectItem value="overtime">Straordinario</SelectItem>
                      <SelectItem value="transfer">Trasferta</SelectItem>
                      <SelectItem value="remote">Smart Working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => setEditForm({ ...editForm, status: v as AbsenceStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">In Attesa</SelectItem>
                      <SelectItem value="approved">Approvato</SelectItem>
                      <SelectItem value="rejected">Rifiutato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-startDate">Data Inizio</Label>
                  <Input
                    id="edit-startDate"
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-endDate">Data Fine</Label>
                  <Input
                    id="edit-endDate"
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    required
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="edit-isFullDay" className="cursor-pointer">Tutto il giorno</Label>
                  <Switch
                    id="edit-isFullDay"
                    checked={editForm.isFullDay}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, isFullDay: checked })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-reason">Causale / Dettagli orario</Label>
                  <Textarea
                    id="edit-reason"
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    placeholder="Es: Tutto il giorno, oppure Dalle 14:30 alle 15:00"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEditDialog}>
                  Annulla
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salva Modifiche
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

