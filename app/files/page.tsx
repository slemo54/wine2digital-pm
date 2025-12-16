"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FolderKanban, Loader2, Search } from "lucide-react";

export default function FilesPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [projects, setProjects] = useState<Array<{ id: string; name: string; status?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        const list = Array.isArray(data?.projects) ? data.projects : [];
        const mapped = list
          .map((p: any) => ({ id: String(p.id), name: String(p.name), status: String(p.status || "") }))
          .filter((p: any) => p.id && p.name);
        if (!cancelled) setProjects(mapped);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-secondary">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">File</CardTitle>
                <div className="text-sm text-muted-foreground">
                  I file sono gestiti per-progetto. Seleziona un progetto e apri la tab “Files”.
                </div>
              </div>
              <Badge variant="secondary">{projects.length} progetti</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca progetto…"
                className="pl-9"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                Nessun progetto trovato.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <Link key={p.id} href={`/project/${p.id}#files`}>
                    <Card className="hover:shadow-md transition-all cursor-pointer border bg-white">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Apri la tab “Files” nel progetto
                            </div>
                          </div>
                          <FolderKanban className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {p.status ? (
                          <div className="mt-3">
                            <Badge variant="outline" className="capitalize">
                              {p.status}
                            </Badge>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

