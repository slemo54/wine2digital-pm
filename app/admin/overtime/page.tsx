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
  date: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: string;
  user: User;
};

export default function AdminOvertimePage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<"approved" | "rejected" | null>(null);

  const { data: requests = [], isLoading } = useQuery<OvertimeRequest[]>({
    queryKey: ["admin-overtime"],
    queryFn: async () => {
      const res = await fetch("/api/overtime/admin");
      if (!res.ok) throw new Error("Errore nel caricamento delle richieste");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note: string }) => {
      const res = await fetch(`/api/overtime/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: note }),
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento della richiesta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-overtime"] });
      toast.success("Richiesta aggiornata con successo");
      setIsUpdateDialogOpen(false);
      setSelectedRequest(null);
      setAdminNote("");
      setUpdateAction(null);
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
      setIsDeleteDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: () => {
      toast.error("Errore nell'eliminazione della richiesta");
    },
  });

  const openUpdateDialog = (request: OvertimeRequest, action: "approved" | "rejected") => {
    setSelectedRequest(request);
    setUpdateAction(action);
    setAdminNote(request.adminNote || "");
    setIsUpdateDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedRequest || !updateAction) return;
    updateMutation.mutate({
      id: selectedRequest.id,
      status: updateAction,
      note: adminNote,
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

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-8 w-8 text-primary" />
          Amministrazione Straordinari
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestisci le richieste di lavoro straordinario inviate dai dipendenti.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento richieste...</div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Clock className="h-8 w-8 text-muted-foreground/50" />
            <p>Nessuna richiesta di straordinari trovata nel sistema.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={request.user?.image || undefined} />
                      <AvatarFallback>{getInitials(request.user?.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{request.user?.name || "Utente Sconosciuto"}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        Rif. {format(new Date(request.date), "dd MMMM yyyy", { locale: it })}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {getStatusBadge(request.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-md whitespace-pre-wrap text-sm">
                  {request.message}
                </div>

                {request.adminNote && (
                  <div className="border-l-2 border-primary pl-4 py-2">
                    <p className="text-xs font-semibold text-primary mb-1">Tua Nota:</p>
                    <p className="text-sm text-muted-foreground">{request.adminNote}</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  {request.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => openUpdateDialog(request, "approved")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approva
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => openUpdateDialog(request, "rejected")}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rifiuta
                      </Button>
                    </>
                  )}
                  {request.status !== "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openUpdateDialog(request, request.status === "approved" ? "rejected" : "approved")}
                    >
                      Modifica Stato
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setSelectedRequest(request);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Update Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {updateAction === "approved" ? "Approva Richiesta" : "Rifiuta Richiesta"}
            </DialogTitle>
            <DialogDescription>
              Stai per {updateAction === "approved" ? "approvare" : "rifiutare"} la richiesta di straordinari di {selectedRequest?.user?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Nota per il dipendente (opzionale)</Label>
              <Textarea
                placeholder="Inserisci un commento o una motivazione..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              variant={updateAction === "approved" ? "default" : "destructive"}
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvataggio..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Richiesta</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare definitivamente questa richiesta di straordinari? Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && deleteMutation.mutate(selectedRequest.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
