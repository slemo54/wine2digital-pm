"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Clock, Filter } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


type AuditActor = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  role: string;
};

type AuditLog = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  metadata: any;
  createdAt: string;
  actor: AuditActor | null;
};

function actorName(a: AuditActor | null): string {
  if (!a) return "Sistema";
  const n = (a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim()).trim();
  return n || a.email;
}


function formatAuditAction(log: AuditLog): string {
  const actor = actorName(log.actor);
  const t = log.actionType;
  const md = log.metadata || {};

  const getEmail = () => md.targetEmail || md.target || "utente";

  if (t === "admin.user_updated") {
    const changes = md.changes;
    if (changes && typeof changes === 'object') {
      const keys = Object.keys(changes);
      if (keys.length === 1) {
        const k = keys[0];
        return `${actor} ha modificato ${k} di ${getEmail()} da ${changes[k].old} a ${changes[k].new}`;
      }
      return `${actor} ha modificato ${keys.length} campi di ${getEmail()}`;
    }
    const field = md.field || "un campo";
    const oldVal = md.oldValue !== undefined ? md.oldValue : "nd";
    const newVal = md.newValue !== undefined ? md.newValue : "nd";
    return `${actor} ha modificato ${field} di ${getEmail()} da ${oldVal} a ${newVal}`;
  }
  if (t === "admin.user_created") return `${actor} ha creato l'utente ${getEmail()}`;
  if (t === "admin.user_deleted") return `${actor} ha eliminato l'utente ${getEmail()}`;
  if (t === "project.created") return `${actor} ha creato il progetto "${md.name || 'nd'}"`;
  if (t === "project.updated") return `${actor} ha aggiornato il progetto "${md.name || 'nd'}"`;
  if (t === "project.deleted") return `${actor} ha eliminato il progetto "${md.name || 'nd'}"`;
  if (t === "task.created") return `${actor} ha creato la task "${md.title || 'nd'}"`;
  if (t === "task.updated") return `${actor} ha aggiornato la task "${md.title || 'nd'}"`;
  if (t === "task.deleted") return `${actor} ha eliminato la task "${md.title || 'nd'}"`;
  if (t === "auth.login") return `${actor} ha eseguito l'accesso`;

  return `${actor} ha eseguito l'azione: ${t}`;
}

export default function AdminAuditPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const sp = useSearchParams();

  const role = (session?.user as any)?.role as string | undefined;
  const isAdmin = role === "admin";

  const [entityType, setEntityType] = useState("User");
  const [entityId, setEntityId] = useState(sp?.get("entityId") || "");
  const [initialEntityId, setInitialEntityId] = useState(sp?.get("entityId") || "");
  const [loading, setLoading] = useState(true);

  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");

  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map(l => l.actionType).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const uniqueActors = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => {
      const n = actorName(l.actor);
      if (!map.has(n)) map.set(n, n);
    });
    return Array.from(map.values()).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (actionFilter !== "all" && l.actionType !== actionFilter) return false;
      if (actorFilter !== "all" && actorName(l.actor) !== actorFilter) return false;
      return true;
    });
  }, [logs, actionFilter, actorFilter]);


  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const load = async (forcedEntityId?: string) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (entityType.trim()) q.set("entityType", entityType.trim());
      if (forcedEntityId !== undefined ? forcedEntityId.trim() : entityId.trim()) q.set("entityId", forcedEntityId !== undefined ? forcedEntityId.trim() : entityId.trim());
      q.set("take", "200");
      const res = await fetch(`/api/admin/audit?${q.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore caricamento audit");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin, initialEntityId]);

  const header = useMemo(() => {
    return (
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5" /> Admin · Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">Tracciamento delle azioni amministrative.</p>
      </div>
    );
  }, []);

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

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Card>
          <CardHeader className="pb-4">{header}</CardHeader>
          <CardContent className="space-y-4">

            {initialEntityId ? (
              <div className="flex items-center justify-between bg-orange-100 text-orange-800 border border-orange-300 rounded-md p-3 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Filtrato per utente: {initialEntityId}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/50 hover:bg-white text-orange-800 border-orange-300"
                  onClick={() => {
                    setEntityId("");
                    setInitialEntityId("");
                    load("");
                  }}
                >
                  Mostra tutti
                </Button>
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="EntityType" />
                </div>
                <div className="md:col-span-7">
                  <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="EntityId (opzionale)" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={() => load(entityId)} variant="outline" className="w-full">
                    Cerca nel server
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t">
                <div>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtra per azione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le azioni</SelectItem>
                      {uniqueActions.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={actorFilter} onValueChange={setActorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtra per autore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti gli autori</SelectItem>
                      {uniqueActors.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>


            {loading ? (
              <div className="py-8 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((l) => (
                  <Collapsible key={l.id} className="border rounded-md bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-foreground">
                          {formatAuditAction(l)}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(l.createdAt).toLocaleString("it-IT", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="shrink-0 text-xs h-7 px-2">
                          Dettagli tecnici
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{l.actionType}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.entityType}
                            {l.entityId ? ` · ${l.entityId}` : ""}
                          </div>
                        </div>
                        {l.metadata ? (
                          <pre className="text-xs text-muted-foreground bg-muted/40 p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap">{JSON.stringify(l.metadata, null, 2)}</pre>
                        ) : null}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}

                {filteredLogs.length === 0 ? <div className="text-sm text-muted-foreground">Nessun evento trovato.</div> : null}
                <div className="text-xs text-muted-foreground mt-4 text-center">
                  Mostrando {filteredLogs.length} di {logs.length} eventi
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




