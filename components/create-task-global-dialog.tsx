"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

type ProjectLite = { id: string; name: string };
type ProjectMemberLite = { user: { id: string; firstName?: string | null; lastName?: string | null; name?: string | null; email: string } };

export function CreateTaskGlobalDialog(props: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string;
}) {
  const { open, onClose, onSuccess, defaultProjectId } = props;
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [members, setMembers] = useState<ProjectMemberLite[]>([]);

  const [projectId, setProjectId] = useState<string>(defaultProjectId || "");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assigneeId: "",
    status: "todo",
  });

  const canSubmit = useMemo(() => Boolean(projectId && formData.title.trim()), [projectId, formData.title]);

  useEffect(() => {
    if (!open) return;
    setProjectId(defaultProjectId || "");
  }, [open, defaultProjectId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProjects(true);
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data?.projects) ? (data.projects as any[]) : [];
        const mapped = list.map((p) => ({ id: String(p.id), name: String(p.name) })).filter((p) => p.id && p.name);
        if (!cancelled) setProjects(mapped);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!projectId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setLoadingMembers(true);
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const m = Array.isArray(data?.project?.members) ? (data.project.members as ProjectMemberLite[]) : [];
        if (!cancelled) setMembers(m);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const displayUser = (m: ProjectMemberLite) => {
    const u = m.user;
    const name = (u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim()).trim();
    return name || u.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const payload = {
        projectId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate || null,
        assigneeIds: formData.assigneeId ? [formData.assigneeId] : [],
      };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Creazione task fallita");
      }
      toast.success("Task creato");
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        assigneeId: "",
        status: "todo",
      });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Creazione task fallita");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crea Task</DialogTitle>
            <DialogDescription>Crea una nuova task e assegnala a un membro del progetto.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Progetto *</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={loading || loadingProjects}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingProjects ? "Caricamento..." : "Seleziona un progetto"} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingProjects && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Caricamento progetti…
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titolo *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                placeholder="Es. Caricamento Dati"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Breve descrizione…"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priorità</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData((f) => ({ ...f, priority: v }))} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scadenza</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData((f) => ({ ...f, dueDate: e.target.value }))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((f) => ({ ...f, status: v }))} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Da fare</SelectItem>
                    <SelectItem value="in_progress">In corso</SelectItem>
                    <SelectItem value="done">Completato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assegna a</Label>
                <Select
                  value={formData.assigneeId}
                  onValueChange={(v) => setFormData((f) => ({ ...f, assigneeId: v === "unassigned" ? "" : v }))}
                  disabled={loading || !projectId || loadingMembers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!projectId ? "Seleziona prima un progetto" : loadingMembers ? "Caricamento..." : "Seleziona"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assegnata</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user.id} value={m.user.id}>
                        {displayUser(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creazione…
                </>
              ) : (
                "Crea Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


