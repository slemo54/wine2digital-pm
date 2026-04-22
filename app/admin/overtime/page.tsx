"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInHours } from "date-fns";
import { it } from "date-fns/locale";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  CalendarIcon,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface OvertimeRequest {
  id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  message: string;
  status: string;
  adminNote?: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default function AdminOvertimePage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  // Filters state
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);


  const { data: requests = [], isLoading } = useQuery<OvertimeRequest[]>({
    queryKey: ["admin-overtime"],
    queryFn: async () => {
      const res = await fetch("/api/overtime/admin");
      if (!res.ok) throw new Error("Errore nel caricamento delle richieste");
      return res.json();
    },
  });

  const uniqueUsers = useMemo(() => {
    const users = new Map();
    requests.forEach(r => {
      if (r.user) {
        users.set(r.user.id, r.user.name || r.user.email);
      }
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [requests]);

  const uniqueDepartments = useMemo(() => {
    const deps = new Set<string>();
    requests.forEach(r => {
      if ((r.user as any)?.department) deps.add((r.user as any).department);
    });
    return Array.from(deps);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Tab filter
      if (activeTab === "pending" && r.status !== "pending") return false;
      if (activeTab === "history" && r.status === "pending") return false;

      // Status filter (only applies in history tab if not 'all', but 'all' means approved + rejected)
      if (activeTab === "history" && filterStatus !== "all" && r.status !== filterStatus) return false;

      // User filter
      if (filterUser !== "all" && r.userId !== filterUser) return false;

      // Department filter
      if (filterDepartment !== "all" && (r.user as any)?.department !== filterDepartment) return false;

      // Date range filter
      if (dateFrom && new Date(r.startDate) < new Date(dateFrom)) return false;
      if (dateTo && new Date(r.endDate) > new Date(new Date(dateTo).setHours(23, 59, 59, 999))) return false;

      return true;
    });
  }, [requests, activeTab, filterStatus, filterUser, filterDepartment, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let reqHoursMonth = 0;
    let appHoursMonth = 0;
    let pendingCount = 0;

    // Uso filteredRequests se i filtri si applicano anche alle card, oppure le requests totali filtrate solo per i filtri espliciti.
    // La richiesta: "calcolate dai dati filtrati con useMemo"
    filteredRequests.forEach(r => {
      const isCurrentMonth = new Date(r.startDate).getMonth() === currentMonth && new Date(r.startDate).getFullYear() === currentYear;

      const hours = differenceInHours(new Date(r.endDate), new Date(r.startDate)) || 0;

      if (isCurrentMonth) {
        reqHoursMonth += hours;
        if (r.status === "approved") {
          appHoursMonth += hours;
        }
      }

      if (r.status === "pending") {
        pendingCount++;
      }
    });

    return { reqHoursMonth, appHoursMonth, pendingCount };
  }, [filteredRequests]);

  const resetFilters = () => {
    setFilterUser("all");
    setFilterDepartment("all");
    setFilterStatus("all");
    setDateFrom("");
    setDateTo("");
  };




  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: string; status: string; adminNote?: string }) => {
      const res = await fetch(`/api/overtime/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento della richiesta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-overtime"] });
      toast.success("Richiesta aggiornata con successo");
      setIsActionDialogOpen(false);
      setSelectedRequest(null);
      setAdminNote("");
      setActionType(null);
    },
    onError: () => {
      toast.error("Errore nell'aggiornamento della richiesta");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/overtime/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione della richiesta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-overtime"] });
      toast.success("Richiesta eliminata");
    },
    onError: () => {
      toast.error("Errore nell'eliminazione della richiesta");
    },
  });

  const handleActionClick = (request: OvertimeRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNote(request.adminNote || "");
    setIsActionDialogOpen(true);
  };

  const submitAction = () => {
    if (!selectedRequest || !actionType) return;

    updateStatusMutation.mutate({
      id: selectedRequest.id,
      status: actionType === "approve" ? "approved" : "rejected",
      adminNote: adminNote.trim() || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Approvato</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rifiutato</Badge>;
      default:
        return <Badge variant="secondary">In attesa</Badge>;
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-8 w-8 text-primary" />
            Gestione Straordinari
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualizza e approva le richieste di lavoro straordinario del team.
          </p>
        </div>
      </div>


      {/* Filters and Stats */}
      {!isLoading && requests.length > 0 && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Utente</label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger><SelectValue placeholder="Tutti gli utenti" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli utenti</SelectItem>
                  {uniqueUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Dipartimento</label>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger><SelectValue placeholder="Tutti i dipartimenti" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i dipartimenti</SelectItem>
                  {uniqueDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Dal</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Al</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <Button variant="outline" onClick={resetFilters} className="w-full">
                Azzera filtri
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground font-medium mb-1">Ore richieste questo mese</div>
              <div className="text-2xl font-bold">{stats.reqHoursMonth}</div>
            </Card>
            <Card className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground font-medium mb-1">Ore approvate questo mese</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.appHoursMonth}</div>
            </Card>
            <Card className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground font-medium mb-1">Richieste in attesa</div>
              <div className="text-2xl font-bold text-orange-500">{stats.pendingCount}</div>
            </Card>
          </div>
        </div>
      )}


      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento richieste...</div>
      ) : requests.length === 0 ? (
        <div className="border border-dashed rounded-lg py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Clock className="h-8 w-8 text-muted-foreground/50" />
          <p>Nessuna richiesta di straordinari da gestire.</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pending">In attesa</TabsTrigger>
            <TabsTrigger value="history">Storico</TabsTrigger>
          </TabsList>

          {activeTab === "history" && (
            <div className="mb-4 w-64">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="Filtra per stato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti (Approvati/Rifiutati)</SelectItem>
                  <SelectItem value="approved">Approvato</SelectItem>
                  <SelectItem value="rejected">Rifiutato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {filteredRequests.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground border rounded-lg bg-white">Nessun risultato corrispondente ai filtri.</div>
          ) : (
        <Accordion type="single" collapsible className="w-full space-y-4">
          {filteredRequests.map((request) => (
            <AccordionItem
              key={request.id}
              value={request.id}
              className="border rounded-lg bg-card shadow-sm px-1"
            >
              <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/30 transition-colors rounded-lg data-[state=open]:rounded-b-none">
                <div className="flex items-center justify-between w-full pr-4 text-left">
                  <div className="flex items-center gap-4 flex-1">
                    <Avatar className="h-10 w-10 border hidden sm:flex">
                      <AvatarImage src={request.user?.image || undefined} alt={request.user?.name || ""} />
                      <AvatarFallback>{getInitials(request.user?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {request.user?.name || request.user?.email || "Utente"}
                        <span className="text-muted-foreground font-normal hidden sm:inline-block">
                          ha richiesto straordinari
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-primary">{request.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(request.startDate), "dd MMM yyyy", { locale: it })}
                        {format(new Date(request.startDate), "dd/MM/yyyy") !== format(new Date(request.endDate), "dd/MM/yyyy") &&
                          ` - ${format(new Date(request.endDate), "dd MMM yyyy", { locale: it })}`
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:block text-xs text-muted-foreground text-right">
                      Inviata il<br/>
                      {format(new Date(request.createdAt), "dd/MM/yyyy HH:mm")}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 border-t">
                <div className="space-y-4 pt-2">
                  <div className="bg-muted/30 rounded-md p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Messaggio della richiesta
                    </h4>
                    <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                      {request.message}
                    </div>
                  </div>

                  {request.adminNote && request.status !== "pending" && (
                    <div className="border-l-2 border-primary pl-4 py-2 bg-primary/5 rounded-r-md">
                      <Label className="text-xs font-semibold text-primary mb-1 block">La tua nota di risposta:</Label>
                      <p className="text-sm text-muted-foreground">{request.adminNote}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto"
                      onClick={() => {
                        if (confirm("Sei sicuro di voler eliminare questa richiesta?")) {
                          deleteMutation.mutate(request.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Elimina Richiesta
                    </Button>

                    <div className="flex gap-2 w-full sm:w-auto">
                      {request.status === "pending" ? (
                        <>
                          <Button
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive flex-1 sm:flex-auto"
                            onClick={() => handleActionClick(request, "reject")}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Rifiuta
                          </Button>
                          <Button
                            className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1 sm:flex-auto"
                            onClick={() => handleActionClick(request, "approve")}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approva
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => handleActionClick(request, request.status === "approved" ? "reject" : "approve")}
                        >
                          Modifica Esito
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
          )}
        </Tabs>
      )}

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approva Richiesta" : "Rifiuta Richiesta"}
            </DialogTitle>
            <DialogDescription>
              Stai per {actionType === "approve" ? "approvare" : "rifiutare"} la richiesta di straordinari di <strong>{selectedRequest?.user?.name || "Utente"}</strong> per &quot;{selectedRequest?.title}&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adminNote">Nota per l&apos;utente (opzionale)</Label>
              <Textarea
                id="adminNote"
                placeholder={actionType === "approve" ? "Es: Ok procedi pure." : "Es: Non approvato perché le ore superano il budget."}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              className={actionType === "approve" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}
              onClick={submitAction}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Salvataggio..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
