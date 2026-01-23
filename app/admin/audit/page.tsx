"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Clock } from "lucide-react";
import { toast } from "react-hot-toast";

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

export default function AdminAuditPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const sp = useSearchParams();

  const role = (session?.user as any)?.role as string | undefined;
  const isAdmin = role === "admin";

  const [entityType, setEntityType] = useState("User");
  const [entityId, setEntityId] = useState(sp?.get("entityId") || "");
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (entityType.trim()) q.set("entityType", entityType.trim());
      if (entityId.trim()) q.set("entityId", entityId.trim());
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
  }, [status, isAdmin]);

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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="EntityType" />
              </div>
              <div className="md:col-span-7">
                <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="EntityId (opzionale)" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={load} variant="outline">
                  Filtra
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="py-8 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((l) => (
                  <div key={l.id} className="border rounded-md bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.actionType}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {l.entityType}
                          {l.entityId ? ` · ${l.entityId}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3.5 w-3.5" /> {new Date(l.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">Actor: {actorName(l.actor)}</div>
                    {l.metadata ? (
                      <pre className="mt-3 text-xs bg-muted/40 p-3 rounded whitespace-pre-wrap">{JSON.stringify(l.metadata, null, 2)}</pre>
                    ) : null}
                  </div>
                ))}
                {logs.length === 0 ? <div className="text-sm text-muted-foreground">Nessun evento.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




