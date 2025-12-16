"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, ArrowLeft } from "lucide-react";
import { toast } from "react-hot-toast";

type WikiPageListItem = {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  updatedAt: string;
  createdAt: string;
};

export default function ProjectWikiIndexPage() {
  const { data: session, status } = useSession() || {};
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [pages, setPages] = useState<WikiPageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wiki`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore caricamento wiki");
      setPages(Array.isArray(data.pages) ? data.pages : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento wiki");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && projectId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, projectId]);

  const createPage = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wiki`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Creazione fallita");
      toast.success("Pagina creata");
      setCreateOpen(false);
      setNewTitle("");
      router.push(`/project/${projectId}/wiki/${data.page.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore creazione");
    } finally {
      setCreating(false);
    }
  };

  const sorted = useMemo(() => {
    return [...pages].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [pages]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href={`/project/${projectId}`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna al progetto
            </Button>
          </Link>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuova pagina
          </Button>
        </div>

        <Card className="bg-white">
          <CardHeader className="pb-3">
            <div>
              <h1 className="text-2xl font-bold">Wiki</h1>
              <p className="text-sm text-muted-foreground">Documentazione del progetto.</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento…
              </div>
            ) : sorted.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Nessuna pagina ancora. Creane una.</div>
            ) : (
              <div className="divide-y">
                {sorted.map((p) => (
                  <Link
                    key={p.id}
                    href={`/project/${projectId}/wiki/${p.id}`}
                    className="block p-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Aggiornata: {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuova pagina Wiki</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titolo pagina…"
                onKeyDown={(e) => e.key === "Enter" && createPage()}
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Annulla
                </Button>
                <Button onClick={createPage} disabled={!newTitle.trim() || creating}>
                  {creating ? "Creazione…" : "Crea"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


