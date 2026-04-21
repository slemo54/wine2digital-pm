"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import { Label } from "@/components/ui/label";

type User = {
  id: string;
  name: string;
  email: string;
  image?: string;
};

type OvertimeRequest = {
  id: string;
  userId: string;
  user: User;
  title: string;
  startDate: string;
  endDate: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: string;
};

export default function AdminOvertimePage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery<OvertimeRequest[]>({
    queryKey: ["admin-overtime"],
    queryFn: async () => {
      const res = await fetch("/api/overtime/admin");
      if (!res.ok) throw new Error("Errore nel caricamento delle richieste");
      return res.json();
    },
  });

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

  const getInitials = (name: string) => {
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

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento richieste...</div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Clock className="h-8 w-8 text-muted-foreground/50" />
            <p>Nessuna richiesta di straordinari da gestire.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-3 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={request.user.image || undefined} alt={request.user.name} />
                      <AvatarFallback>{getInitials(request.user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{request.user.name}</CardTitle>
                      <CardDescription className="flex flex-col gap-1 mt-1">
                        <span className="font-medium text-foreground">{request.title}</span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {format(new Date(request.startDate), "dd MMM yyyy", { locale: it })}
                          {format(new Date(request.startDate), "dd/MM/yyyy") !== format(new Date(request.endDate), "dd/MM/yyyy") &&
                            ` - ${format(new Date(request.endDate), "dd MMM yyyy", { locale: it })}`
                          }
                          <span className="mx-2 text-muted-foreground/50">•</span>
                          Inviata: {format(new Date(request.createdAt), "dd/MM/yyyy HH:mm")}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(request.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm("Sei sicuro di voler eliminare questa richiesta?")) {
                          deleteMutation.mutate(request.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Elimina
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Dettagli / Messaggio:</Label>
                    <div className="bg-muted/50 p-4 rounded-md whitespace-pre-wrap text-sm border">
                      {request.message}
                    </div>
                  </div>

                  {request.adminNote && request.status !== "pending" && (
                    <div className="border-l-2 border-primary pl-4 py-2">
                      <Label className="text-xs font-semibold text-primary mb-1 block">La tua nota:</Label>
                      <p className="text-sm text-muted-foreground">{request.adminNote}</p>
                    </div>
                  )}

                  {request.status === "pending" && (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleActionClick(request, "reject")}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rifiuta
                      </Button>
                      <Button
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleActionClick(request, "approve")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approva
                      </Button>
                    </div>
                  )}

                  {request.status !== "pending" && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActionClick(request, request.status === "approved" ? "reject" : "approve")}
                      >
                        Modifica Esito
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approva Richiesta" : "Rifiuta Richiesta"}
            </DialogTitle>
            <DialogDescription>
              Stai per {actionType === "approve" ? "approvare" : "rifiutare"} la richiesta di straordinari di <strong>{selectedRequest?.user?.name}</strong> per &quot;{selectedRequest?.title}&quot;.
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
