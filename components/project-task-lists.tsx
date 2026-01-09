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
  legacyTags?: string | null;
  tags?: Array<{ id: string; name: string }>;
  amountCents?: number | null;
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

function parseLegacyTags(legacyTags: string | null | undefined): string[] {
  if (!legacyTags) return [];
  try {
    const parsed = JSON.parse(String(legacyTags));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function getDisplayTagNames(t: TaskDto): string[] {
  const rel = Array.isArray(t.tags) ? t.tags.map((x) => String(x?.name || "").trim()).filter(Boolean) : [];
  if (rel.length > 0) return rel;
  return parseLegacyTags(t.legacyTags);
}

function getTagBadgeClass(tagName: string): string {
  const n = String(tagName || "").trim().toUpperCase();
  if (n === "PAGATO") return "bg-emerald-500 text-white border-emerald-600/20";
  if (n === "STAND BY") return "bg-orange-500 text-white border-orange-600/20";
  if (n === "FATTURA EMESSA") return "bg-sky-500 text-white border-sky-600/20";
  return "bg-primary text-primary-foreground border-primary/20";
}

export function ProjectTaskLists(props: {
  projectId: string;
  sessionUserId?: string | null;
  sessionGlobalRole?: string | null;
  projectMembers?: any[];
}) {
  const { projectId, sessionUserId, sessionGlobalRole, projectMembers } = props;
  const meId = sessionUserId ? String(sessionUserId) : null;
  const globalRole = String(sessionGlobalRole || "member");
  const myMembership = meId && Array.isArray(projectMembers)
    ? projectMembers.find((m: any) => m?.userId === meId) || null
    : null;
  const isProjectMember = Boolean(myMembership);
  const myProjectRole = myMembership?.role ? String(myMembership.role) : "";
  const isProjectManager = myProjectRole === "owner" || myProjectRole === "manager";
  const canManageTasks = globalRole === "admin" || isProjectManager || (globalRole === "manager" && isProjectMember);
  const noPermissionHint = "Solo admin o project owner/manager possono modificare o eliminare le task.";

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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [savingTaskTitle, setSavingTaskTitle] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
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

  const startEditTaskTitle = (t: TaskDto) => {
    if (!canManageTasks) {
      toast.error(noPermissionHint);
      return;
    }
    setEditingTaskId(t.id);
    setEditingTaskTitle(t.title || "");
  };

  const cancelEditTaskTitle = () => {
    setEditingTaskId(null);
    setEditingTaskTitle("");
  };

  const saveEditedTaskTitle = async () => {
    if (!editingTaskId) return;
    if (!canManageTasks) {
      toast.error(noPermissionHint);
      return;
    }
    const title = editingTaskTitle.trim();
    if (!title) return;
    setSavingTaskTitle(true);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(editingTaskId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile aggiornare titolo");
      setTasks((prev) => prev.map((t) => (t.id === editingTaskId ? { ...t, title } : t)));
      toast.success("Titolo aggiornato");
      cancelEditTaskTitle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile aggiornare titolo");
    } finally {
      setSavingTaskTitle(false);
    }
  };

  const deleteTask = async (t: TaskDto) => {
    if (!canManageTasks) {
      toast.error(noPermissionHint);
      return;
    }
    if (!confirm(`Eliminare la task “${t.title}”?`)) return;
    setDeletingTaskId(t.id);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile eliminare task");

      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      setTasksTotal((prev) => Math.max(0, prev - 1));
      if (t.listId) {
        setLists((prev) =>
          prev.map((l) =>
            l.id === t.listId
              ? { ...l, _count: l._count ? { tasks: Math.max(0, (l._count.tasks || 0) - 1) } : l._count }
              : l
          )
        );
      }
      if (selectedTaskId === t.id) setSelectedTaskId(null);
      toast.success("Task eliminata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile eliminare task");
    } finally {
      setDeletingTaskId(null);
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
                      const tagNames = getDisplayTagNames(t);
                      const primaryTag = tagNames[0] || null;
                      const extraTagCount = tagNames.length > 1 ? tagNames.length - 1 : 0;
                      const isEditing = editingTaskId === t.id;
                      const isDeleting = deletingTaskId === t.id;
                      const disableRowOpen = isEditing;
                      return (
                        <div
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          className="w-full text-left border rounded-lg p-3 hover:bg-muted/30 transition-colors group"
                          onClick={() => {
                            if (disableRowOpen) return;
                            setSelectedTaskId(t.id);
                          }}
                          onKeyDown={(e) => {
                            if (disableRowOpen) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedTaskId(t.id);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    value={editingTaskTitle}
                                    onChange={(e) => setEditingTaskTitle(e.target.value)}
                                    disabled={!canManageTasks || savingTaskTitle}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelEditTaskTitle();
                                      }
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void saveEditedTaskTitle();
                                      }
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => void saveEditedTaskTitle()}
                                    disabled={!canManageTasks || savingTaskTitle || !editingTaskTitle.trim()}
                                  >
                                    {savingTaskTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEditTaskTitle}
                                    disabled={savingTaskTitle}
                                  >
                                    Annulla
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="font-medium truncate">{t.title}</div>
                                  {t.description ? (
                                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</div>
                                  ) : null}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {primaryTag ? (
                                <Badge
                                  variant="default"
                                  className={`rounded-md px-4 py-1 text-[11px] font-semibold uppercase tracking-wide min-w-[140px] justify-center ${getTagBadgeClass(primaryTag)}`}
                                  title={tagNames.join(", ")}
                                >
                                  {primaryTag}
                                </Badge>
                              ) : null}
                              {extraTagCount > 0 ? (
                                <Badge variant="outline" title={tagNames.join(", ")}>
                                  +{extraTagCount}
                                </Badge>
                              ) : null}
                              <Badge variant={sb.variant} className="capitalize">
                                {sb.label}
                              </Badge>
                              {t.dueDate ? (
                                <Badge variant="outline">{new Date(t.dueDate).toLocaleDateString()}</Badge>
                              ) : null}

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => startEditTaskTitle(t)}
                                  disabled={!canManageTasks || isEditing}
                                  title={canManageTasks ? "Modifica titolo" : noPermissionHint}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => void deleteTask(t)}
                                  disabled={!canManageTasks || isDeleting || isEditing}
                                  title={canManageTasks ? "Elimina task" : noPermissionHint}
                                >
                                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
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


