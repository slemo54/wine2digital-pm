"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, Save, History, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

type WikiPage = {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type Revision = {
  id: string;
  createdAt: string;
  createdBy: { id: string; email: string; name: string | null; firstName: string | null; lastName: string | null };
};

export default function ProjectWikiPage() {
  const { data: session, status } = useSession() || {};
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const pageId = params?.pageId as string;

  const [page, setPage] = useState<WikiPage | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const load = async () => {
    setLoading(true);
    try {
      const [pageRes, revRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/wiki/${pageId}`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/wiki/${pageId}/revisions`, { cache: "no-store" }),
      ]);
      const [pageData, revData] = await Promise.all([pageRes.json(), revRes.json()]);
      if (!pageRes.ok) throw new Error(pageData?.error || "Errore caricamento pagina");
      setPage(pageData.page);
      setDraftTitle(String(pageData.page.title || ""));
      setDraftContent(String(pageData.page.content || ""));
      setRevisions(Array.isArray(revData.revisions) ? revData.revisions : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && projectId && pageId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, projectId, pageId]);

  const save = async () => {
    if (!page) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wiki/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle.trim(), content: draftContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Salvataggio fallito");
      toast.success("Salvato");
      setPage(data.page);
      // refresh revisions
      const revRes = await fetch(`/api/projects/${projectId}/wiki/${pageId}/revisions`, { cache: "no-store" });
      const revData = await revRes.json();
      setRevisions(Array.isArray(revData.revisions) ? revData.revisions : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Vuoi archiviare questa pagina?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wiki/${pageId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Eliminazione fallita");
      toast.success("Pagina archiviata");
      router.push(`/project/${projectId}/wiki`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    } finally {
      setDeleting(false);
    }
  };

  const preview = useMemo(() => {
    // MVP: preview “plain” (nessuna lib markdown nel repo)
    return draftContent;
  }, [draftContent]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href={`/project/${projectId}/wiki`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Wiki
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={remove} disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? "…" : "Archivia"}
            </Button>
            <Button onClick={save} disabled={saving || !draftTitle.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="text-lg font-semibold" />
                <div className="text-xs text-muted-foreground">
                  Ultimo aggiornamento: {new Date(page.updatedAt).toLocaleString()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Scrivi qui la documentazione (MVP: testo/markdown semplice)…"
                  className="min-h-[360px]"
                />
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader className="pb-3">
                <div className="text-sm font-semibold">Preview</div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm leading-6">{preview}</pre>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="bg-white">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" />
                  Revisioni
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <ScrollArea className="h-[560px]">
                  <div className="divide-y">
                    {revisions.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">Nessuna revisione ancora.</div>
                    ) : (
                      revisions.map((r) => (
                        <div key={r.id} className="p-4">
                          <div className="text-sm font-medium">{new Date(r.createdAt).toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.createdBy?.name ||
                              `${r.createdBy?.firstName || ""} ${r.createdBy?.lastName || ""}`.trim() ||
                              r.createdBy?.email}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


