"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { DateRange } from "react-day-picker";

type OvertimeRequest = {
  id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: string;
};

export default function OvertimePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [message, setMessage] = useState("");

  const { data: requests = [], isLoading } = useQuery<OvertimeRequest[]>({
    queryKey: ["overtime"],
    queryFn: async () => {
      const res = await fetch("/api/overtime");
      if (!res.ok) throw new Error("Errore nel caricamento delle richieste");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newRequest: { title: string; startDate: string; endDate: string; message: string }) => {
      const res = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRequest),
      });
      if (!res.ok) throw new Error("Errore nella creazione della richiesta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overtime"] });
      toast.success("Richiesta inviata con successo");
      setIsDialogOpen(false);
      setTitle("");
      setMessage("");
      setDateRange({ from: new Date(), to: new Date() });
    },
    onError: () => {
      toast.error("Errore nell'invio della richiesta");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateRange?.from || !dateRange?.to || !message.trim()) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      message: message.trim(),
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-8 w-8 text-primary" />
            Straordinari
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci le tue richieste per ore di lavoro straordinario.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuova Richiesta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Richiesta Straordinari</DialogTitle>
                <DialogDescription>
                  Invia una nuova comunicazione all&apos;amministrazione. Specifica il periodo e spiega nel dettaglio il lavoro svolto.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Titolo della richiesta</label>
                  <Input
                    placeholder="Es: Straordinari Vinitaly 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Periodo di riferimento</label>
                  <DateRangePicker
                    value={dateRange as DateRange}
                    onChange={(value) => setDateRange(value)}
                    className="w-full"
                    portalled={false}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Messaggio / Dettagli</label>
                  <Textarea
                    placeholder="Es: Ho lavorato 3 ore in più per chiudere la consegna del progetto X..."
                    className="min-h-[150px]"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Invio in corso..." : "Invia Richiesta"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento richieste...</div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Clock className="h-8 w-8 text-muted-foreground/50" />
            <p>Nessuna richiesta di straordinari trovata.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {request.title}
                    </CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(new Date(request.startDate), "dd MMM yyyy", { locale: it })}
                      {format(new Date(request.startDate), "dd/MM/yyyy") !== format(new Date(request.endDate), "dd/MM/yyyy") &&
                        ` - ${format(new Date(request.endDate), "dd MMM yyyy", { locale: it })}`
                      }
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
                <CardDescription className="mt-2">
                  Inviata il {format(new Date(request.createdAt), "dd/MM/yyyy HH:mm")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-4 rounded-md whitespace-pre-wrap text-sm">
                  {request.message}
                </div>

                {request.adminNote && (
                  <div className="mt-4 border-l-2 border-primary pl-4 py-2">
                    <p className="text-xs font-semibold text-primary mb-1">Nota Amministrazione:</p>
                    <p className="text-sm text-muted-foreground">{request.adminNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
