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
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

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

function statusBadge(status: AbsenceStatus): { label: string; className: string } {
  if (status === "pending") return { label: "pending", className: "bg-warning/10 text-warning border-warning" };
  if (status === "approved") return { label: "approved", className: "bg-success/10 text-success border-success" };
  return { label: "rejected", className: "bg-destructive/10 text-destructive border-destructive" };
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [deleteBefore, setDeleteBefore] = useState("");
  const [deleteRangeFrom, setDeleteRangeFrom] = useState("");
  const [deleteRangeTo, setDeleteRangeTo] = useState("");

  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

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

  const header = useMemo(() => {
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Admin · Archivio richieste
          </h1>
          <p className="text-sm text-muted-foreground">
            Ricerca, filtra e rimuovi richieste storiche (pending/approved/rejected).
          </p>
        </div>
        {counts ? (
          <div className="text-xs text-muted-foreground text-right">
            <div>Pending: {counts.pending}</div>
            <div>Approved: {counts.approved}</div>
            <div>Rejected: {counts.rejected}</div>
          </div>
        ) : null}
      </div>
    );
  }, [counts]);

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
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <Card>
          <CardHeader className="pb-4">{header}</CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per utente o reason…" />
              </div>
              <div className="md:col-span-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli status</SelectItem>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="approved">approved</SelectItem>
                    <SelectItem value="rejected">rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    <SelectItem value="vacation">vacation</SelectItem>
                    <SelectItem value="sick_leave">sick_leave</SelectItem>
                    <SelectItem value="personal">personal</SelectItem>
                    <SelectItem value="late_entry">late_entry</SelectItem>
                    <SelectItem value="early_exit">early_exit</SelectItem>
                    <SelectItem value="overtime">overtime</SelectItem>
                    <SelectItem value="transfer">transfer</SelectItem>
                    <SelectItem value="remote">remote</SelectItem>
                    <SelectItem value="ooo">ooo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Dal" />
              </div>
              <div className="md:col-span-2">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Al" />
              </div>

              <div className="md:col-span-2">
                <Input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  placeholder="Creato dal"
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  type="date"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  placeholder="Creato al"
                />
              </div>
              <div className="md:col-span-2">
                <Select value={String(take)} onValueChange={(v) => setTake(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Per pagina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 / pagina</SelectItem>
                    <SelectItem value="50">50 / pagina</SelectItem>
                    <SelectItem value="100">100 / pagina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Button variant="outline" onClick={() => setPage(0)}>
                  Applica
                </Button>
                <Button variant="outline" onClick={load}>
                  Aggiorna
                </Button>
              </div>
            </div>

            {/* Bulk actions */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-md border bg-card p-3">
              <div className="md:col-span-4 flex items-center gap-2">
                <Button
                  variant="destructive"
                  disabled={!anySelected}
                  onClick={() =>
                    openConfirm({
                      mode: "selected",
                      title: "Elimina richieste selezionate",
                      description: "Questa azione rimuove definitivamente le richieste selezionate.",
                      payload: { ids: selectedIds },
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina selezionate ({selectedIds.length})
                </Button>
              </div>

              <div className="md:col-span-4 flex items-center gap-2">
                <Input
                  type="date"
                  value={deleteBefore}
                  onChange={(e) => setDeleteBefore(e.target.value)}
                  placeholder="Prima di…"
                />
                <Button
                  variant="outline"
                  disabled={!deleteBefore}
                  onClick={() =>
                    openConfirm({
                      mode: "before",
                      title: "Elimina richieste create prima di…",
                      description: "Verranno eliminate tutte le richieste create prima della data selezionata.",
                      payload: { before: new Date(deleteBefore).toISOString() },
                    })
                  }
                >
                  DryRun + Elimina
                </Button>
              </div>

              <div className="md:col-span-4 flex items-center gap-2">
                <Input type="date" value={deleteRangeFrom} onChange={(e) => setDeleteRangeFrom(e.target.value)} />
                <Input type="date" value={deleteRangeTo} onChange={(e) => setDeleteRangeTo(e.target.value)} />
                <Button
                  variant="outline"
                  disabled={!deleteRangeFrom && !deleteRangeTo}
                  onClick={() =>
                    openConfirm({
                      mode: "createdRange",
                      title: "Elimina richieste nel range creazione",
                      description: "Verranno eliminate le richieste con createdAt nel range indicato.",
                      payload: {
                        createdFrom: deleteRangeFrom ? new Date(deleteRangeFrom).toISOString() : undefined,
                        createdTo: deleteRangeTo ? new Date(deleteRangeTo).toISOString() : undefined,
                      },
                    })
                  }
                >
                  DryRun + Elimina
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="py-8 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden bg-white">
                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  <div className="col-span-1">
                    <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAllOnPage(Boolean(v))} />
                  </div>
                  <div className="col-span-3">Utente</div>
                  <div className="col-span-2">Tipo</div>
                  <div className="col-span-2">Periodo</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Azioni</div>
                </div>
                <div className="divide-y">
                  {rows.map((r) => {
                    const b = statusBadge(r.status);
                    return (
                      <div
                        key={r.id}
                        className="px-4 py-3 flex flex-col gap-3 md:grid md:grid-cols-12 md:gap-3 md:items-center"
                      >
                        <div className="md:col-span-1">
                          <Checkbox checked={selectedIds.includes(r.id)} onCheckedChange={(v) => toggleOne(r.id, Boolean(v))} />
                        </div>
                        <div className="md:col-span-3 min-w-0">
                          <div className="font-medium truncate">{displayName(r.user)}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.user.email}</div>
                          <div className="text-[11px] text-muted-foreground truncate">Creato: {formatDateTime(r.createdAt)}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground md:hidden mb-1">Tipo</div>
                          <div className="font-medium">{r.type}</div>
                          {r.reason ? <div className="text-xs text-muted-foreground line-clamp-2">{r.reason}</div> : null}
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground md:hidden mb-1">Periodo</div>
                          <div className="text-sm">
                            {formatDate(r.startDate)} → {formatDate(r.endDate)}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <Badge variant="outline" className={b.className}>
                            {b.label}
                          </Badge>
                        </div>
                        <div className="md:col-span-2 md:text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full md:w-auto text-destructive border-destructive hover:bg-destructive hover:text-white"
                            onClick={() =>
                              openConfirm({
                                mode: "row",
                                title: "Elimina richiesta",
                                description: `Eliminare definitivamente la richiesta di ${displayName(r.user)} (${r.type})?`,
                                payload: { rowId: r.id },
                              })
                            }
                          >
                            Elimina
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {rows.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">Nessuna richiesta trovata.</div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Pagina {page + 1} / {maxPage + 1} · Totale risultati: {total}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= maxPage}
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                >
                  Next
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
      </div>
    </div>
  );
}

