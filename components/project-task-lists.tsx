"use client";

import { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateTaskGlobalDialog } from "@/components/create-task-global-dialog";
import { TaskDetailModal } from "@/components/task-detail-modal";

type ListDto = { id: string; name: string; updatedAt: string; _count?: { tasks: number } };

type TaskDto = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  listId: string | null;
  taskList: { id: string; name: string } | null;
};

const DEFAULT_LIST_NAME = "Untitled list";

function statusBadge(status: string): { label: string; variant: "secondary" | "outline" | "default" } {
  switch (status) {
    case "todo":
      return { label: "To do", variant: "outline" };
    case "in_progress":
      return { label: "In progress", variant: "secondary" };
    case "done":
      return { label: "Done", variant: "default" };
    default:
      return { label: status, variant: "outline" };
  }
}

export function ProjectTaskLists({ projectId }: { projectId: string }) {
  const [lists, setLists] = useState<ListDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [listsUnavailable, setListsUnavailable] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);

  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [savingList, setSavingList] = useState(false);

  const [renameListId, setRenameListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [defaultListIdForNewTask, setDefaultListIdForNewTask] = useState<string | undefined>(undefined);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [listsRes, tasksRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/lists`, { cache: "no-store" }),
        fetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}&page=1&pageSize=200`, { cache: "no-store" }),
      ]);

      const listsData = await listsRes.json().catch(() => ({}));
      const tasksData = await tasksRes.json().catch(() => ({}));

      if (listsRes.status === 501) {
        setListsUnavailable(listsData?.error || "Liste non disponibili (migrations non applicate).");
        setLists([]);
      } else if (!listsRes.ok) {
        throw new Error(listsData?.error || "Errore caricamento liste");
      } else {
        const l = Array.isArray(listsData?.lists) ? (listsData.lists as ListDto[]) : [];
        setLists(l);
        setListsUnavailable(null);
        if (expanded.length === 0 && l.length > 0) setExpanded([l[0].id]);
      }

      const t = Array.isArray(tasksData?.tasks) ? (tasksData.tasks as TaskDto[]) : [];
      setTasks(t);
      setTasksPage(1);
      setTasksTotal(Number.isFinite(tasksData?.total) ? Number(tasksData.total) : t.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTasks = async () => {
    if (loadingMore) return;
    if (tasks.length >= tasksTotal) return;
    const nextPage = tasksPage + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/tasks?projectId=${encodeURIComponent(projectId)}&page=${nextPage}&pageSize=200`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore caricamento task");
      const next = Array.isArray(data?.tasks) ? (data.tasks as TaskDto[]) : [];
      setTasks((prev) => [...prev, ...next]);
      setTasksPage(nextPage);
      setTasksTotal(Number.isFinite(data?.total) ? Number(data.total) : tasksTotal);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento task");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filteredTasks = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((t) => {
      const hay = `${t.title} ${t.description || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [tasks, q]);

  const tasksByListId = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const t of filteredTasks) {
      const key = t.listId || "__none__";
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [filteredTasks]);

  const createList = async () => {
    const name = newListName.trim();
    if (!name) return;
    setSavingList(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile creare categoria");
      toast.success("Categoria creata");
      setNewListName("");
      setShowCreateList(false);
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile creare categoria");
    } finally {
      setSavingList(false);
    }
  };

  const renameList = async () => {
    if (!renameListId) return;
    const name = renameValue.trim();
    if (!name) return;
    setSavingList(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/lists/${renameListId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile rinominare categoria");
      toast.success("Categoria rinominata");
      setRenameListId(null);
      setRenameValue("");
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile rinominare categoria");
    } finally {
      setSavingList(false);
    }
  };

  const deleteList = async (listId: string, name: string) => {
    if (!confirm(`Eliminare la categoria “${name}”? Le task verranno spostate in “${DEFAULT_LIST_NAME}”.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/lists/${listId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile eliminare categoria");
      toast.success("Categoria eliminata");
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile eliminare categoria");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  if (listsUnavailable) {
    return (
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="font-semibold mb-1">Categorie non disponibili</div>
          <div className="text-sm text-muted-foreground">{listsUnavailable}</div>
          <div className="text-sm text-muted-foreground mt-3">
            Applica la migration Prisma e poi esegui il backfill (`scripts/backfill-task-lists.ts`).
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca task…" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCreateList(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuova categoria
          </Button>
        </div>
      </div>

      <Accordion type="multiple" value={expanded} onValueChange={(v) => setExpanded(v)}>
        {lists.map((l) => {
          const listTasks = tasksByListId.get(l.id) || [];
          return (
            <AccordionItem key={l.id} value={l.id} className="border rounded-lg mb-3 bg-white">
              <AccordionTrigger className="px-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="font-semibold truncate">{l.name}</div>
                    <Badge variant="secondary">
                      {listTasks.length}/{l._count?.tasks ?? listTasks.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDefaultListIdForNewTask(l.id);
                        setShowCreateTask(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add task
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRenameListId(l.id);
                        setRenameValue(l.name);
                      }}
                      title="Rinomina"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteList(l.id, l.name);
                      }}
                      title="Elimina"
                      disabled={l.name === DEFAULT_LIST_NAME}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                {listTasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3">Nessuna task in questa categoria.</div>
                ) : (
                  <div className="space-y-2">
                    {listTasks.map((t) => {
                      const sb = statusBadge(t.status);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="w-full text-left border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                          onClick={() => setSelectedTaskId(t.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{t.title}</div>
                              {t.description ? (
                                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={sb.variant} className="capitalize">
                                {sb.label}
                              </Badge>
                              {t.dueDate ? (
                                <Badge variant="outline">{new Date(t.dueDate).toLocaleDateString()}</Badge>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {tasks.length > 0 && tasks.length < tasksTotal ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMoreTasks} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Carica altre task ({tasksTotal - tasks.length})
          </Button>
        </div>
      ) : null}

      <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Es. Comunicazione" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateList(false)} disabled={savingList}>
              Annulla
            </Button>
            <Button onClick={createList} disabled={savingList || !newListName.trim()}>
              {savingList ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameListId} onOpenChange={(v) => !v && setRenameListId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rinomina categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameListId(null)} disabled={savingList}>
              Annulla
            </Button>
            <Button onClick={renameList} disabled={savingList || !renameValue.trim()}>
              {savingList ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateTaskGlobalDialog
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onSuccess={async () => {
          setShowCreateTask(false);
          setDefaultListIdForNewTask(undefined);
          await fetchAll();
        }}
        defaultProjectId={projectId}
        defaultListId={defaultListIdForNewTask}
      />

      {selectedTaskId ? (
        <TaskDetailModal
          open={true}
          onClose={() => setSelectedTaskId(null)}
          taskId={selectedTaskId}
          projectId={projectId}
          onUpdate={fetchAll}
        />
      ) : null}
    </div>
  );
}


