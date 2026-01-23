"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { ArrowLeft, Loader2, Search, Calendar, Paperclip, MessageCircle, ListChecks, Plus } from "lucide-react";
import { CreateTaskGlobalDialog } from "@/components/create-task-global-dialog";

type ProjectLite = { id: string; name: string };

type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectLite;
  assignees: Array<{
    userId: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      image: string | null;
    };
  }>;
  _count: { comments: number; attachments: number; subtasks: number };
};

type SubtaskListItem = {
  id: string;
  taskId: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  task: { id: string; title: string; project: ProjectLite };
};

export default function TasksPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
  const [assignedSubtasks, setAssignedSubtasks] = useState<SubtaskListItem[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const [filters, setFilters] = useState<{
    scope: "all" | "assigned" | "projects";
    status: string;
    priority: string;
    projectId: string;
    dueFrom: string;
    dueTo: string;
    q: string;
    tag: string;
  }>({
    scope: "all",
    status: "all",
    priority: "all",
    projectId: "all",
    dueFrom: "",
    dueTo: "",
    q: "",
    tag: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    const taskIdFromUrl = searchParams?.get("taskId");
    const subtaskIdFromUrl = searchParams?.get("subtaskId");
    const scopeFromUrl = searchParams?.get("scope");
    if (scopeFromUrl === "all" || scopeFromUrl === "assigned" || scopeFromUrl === "projects") {
      setFilters((f) => (f.scope === scopeFromUrl ? f : { ...f, scope: scopeFromUrl as any }));
    }
    if (taskIdFromUrl) {
      setSelectedTaskId(taskIdFromUrl);
      setSelectedSubtaskId(subtaskIdFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/projects?page=1&limit=200");
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.projects) ? (data.projects as any[]) : [];
        const mapped = list
          .map((p) => ({ id: String(p.id), name: String(p.name) }))
          .filter((p) => p.id && p.name);
        if (!cancelled) setProjects(mapped);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const baseQueryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("scope", filters.scope);
    if (filters.status && filters.status !== "all") sp.set("status", filters.status);
    if (filters.priority && filters.priority !== "all") sp.set("priority", filters.priority);
    if (filters.projectId && filters.projectId !== "all") sp.set("projectId", filters.projectId);
    if (filters.dueFrom) sp.set("dueFrom", filters.dueFrom);
    if (filters.dueTo) sp.set("dueTo", filters.dueTo);
    if (filters.q.trim()) sp.set("q", filters.q.trim());
    if (filters.tag.trim()) sp.set("tag", filters.tag.trim());
    return sp.toString();
  }, [filters]);

  const baseSubtasksQueryString = useMemo(() => {
    if (filters.scope !== "assigned") return "";
    const sp = new URLSearchParams();
    sp.set("scope", "assigned");
    if (filters.status && filters.status !== "all") sp.set("status", filters.status);
    if (filters.priority && filters.priority !== "all") sp.set("priority", filters.priority);
    if (filters.projectId && filters.projectId !== "all") sp.set("projectId", filters.projectId);
    if (filters.dueFrom) sp.set("dueFrom", filters.dueFrom);
    if (filters.dueTo) sp.set("dueTo", filters.dueTo);
    if (filters.q.trim()) sp.set("q", filters.q.trim());
    return sp.toString();
  }, [filters.scope, filters.status, filters.priority, filters.projectId, filters.dueFrom, filters.dueTo, filters.q]);

  const openTaskDetail = (opts: { taskId: string; subtaskId?: string | null }) => {
    setSelectedTaskId(opts.taskId);
    setSelectedSubtaskId(opts.subtaskId || null);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("taskId", opts.taskId);
    if (opts.subtaskId) params.set("subtaskId", opts.subtaskId);
    else params.delete("subtaskId");
    router.push(`/tasks?${params.toString()}`);
  };

  const fetchTasksPage = async (opts: { page: number; append: boolean }) => {
    const sp = new URLSearchParams(baseQueryString);
    sp.set("page", String(opts.page));
    sp.set("pageSize", String(pageSize));
    const res = await fetch(`/api/tasks?${sp.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error || "Failed to load tasks");
    const list = Array.isArray((data as any)?.tasks) ? ((data as any).tasks as TaskListItem[]) : [];
    const nextTotal = Number.isFinite((data as any)?.total) ? Number((data as any).total) : list.length;
    setTotal(nextTotal);
    setTasks((prev) => (opts.append ? [...prev, ...list] : list));
    setPage(opts.page);
  };

  const fetchAssignedSubtasks = async () => {
    if (filters.scope !== "assigned") {
      setAssignedSubtasks([]);
      return;
    }
    if (!baseSubtasksQueryString) {
      setAssignedSubtasks([]);
      return;
    }
    setLoadingSubtasks(true);
    try {
      const sp = new URLSearchParams(baseSubtasksQueryString);
      sp.set("page", "1");
      sp.set("pageSize", "100");
      const res = await fetch(`/api/subtasks?${sp.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Failed to load subtasks");
      const list = Array.isArray((data as any)?.subtasks) ? ((data as any).subtasks as SubtaskListItem[]) : [];
      setAssignedSubtasks(list);
    } catch {
      setAssignedSubtasks([]);
    } finally {
      setLoadingSubtasks(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    setLoadingList(true);
    setPage(1);

    const t = setTimeout(async () => {
      try {
        await fetchTasksPage({ page: 1, append: false });
      } catch {
        if (!cancelled) {
          setTasks([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [status, baseQueryString]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await fetchAssignedSubtasks();
      } finally {
        // ignore
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, baseSubtasksQueryString]);

  if (status === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/30";
      case "medium":
        return "bg-warning/10 text-warning border-warning/30";
      case "low":
        return "bg-success/10 text-success border-success/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "done":
        return "bg-success/10 text-success border-success/30";
      case "in_progress":
        return "bg-info/10 text-info border-info/30";
      case "archived":
        return "bg-muted text-muted-foreground border-border";
      case "todo":
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const parseTags = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  const initials = (t: TaskListItem["assignees"][number]["user"]) => {
    const name = (t.firstName || t.name || t.email || "").trim();
    const parts = name.split(" ").filter(Boolean);
    return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tutte le mie task</h1>
            <p className="text-muted-foreground mt-1">
              Filtra per status, priorità, progetto, scadenza, testo e tag.
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateTask(true)} 
            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
          >
            <Plus className="mr-2 h-4 w-4" /> Crea Task
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-card/50 shadow-sm backdrop-blur-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Cerca per titolo o descrizione..."
                  className="pl-9 bg-background/50 border-border/50 h-10"
                />
              </div>
              <div className="w-full md:w-[200px]">
                <Select value={filters.scope} onValueChange={(v) => setFilters((f) => ({ ...f, scope: v as any }))}>
                  <SelectTrigger className="bg-background/50 border-border/50 h-10">
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte</SelectItem>
                    <SelectItem value="assigned">Assegnate a me</SelectItem>
                    <SelectItem value="projects">Nei miei progetti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-background/50 border-border/50 h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli status</SelectItem>
                  <SelectItem value="todo">Da fare</SelectItem>
                  <SelectItem value="in_progress">In corso</SelectItem>
                  <SelectItem value="done">Completate</SelectItem>
                  <SelectItem value="archived">Archiviate</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
                <SelectTrigger className="bg-background/50 border-border/50 h-10">
                  <SelectValue placeholder="Priorità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le priorità</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Bassa</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.projectId} onValueChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}>
                <SelectTrigger className="bg-background/50 border-border/50 h-10">
                  <SelectValue placeholder="Progetto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i progetti</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.dueFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dueFrom: e.target.value }))}
                  className="pl-9 bg-background/50 border-border/50 h-10"
                />
              </div>
              <Input
                type="date"
                value={filters.dueTo}
                onChange={(e) => setFilters((f) => ({ ...f, dueTo: e.target.value }))}
                className="bg-background/50 border-border/50 h-10"
              />
            </div>
            
            <div className="flex">
               <Input
                  value={filters.tag}
                  onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
                  placeholder="Tag (es. Homepage)..."
                  className="bg-background/50 border-border/50 h-10"
                />
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        <Card className="border-border/50 bg-card/50 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[70vh] h-[70dvh]">
              <div className="divide-y divide-border/40">
                {loadingList ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>Caricamento task in corso...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground text-center">
                    <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-2">
                      <ListChecks className="h-6 w-6 opacity-50" />
                    </div>
                    <p>Nessuna task trovata con i filtri correnti.</p>
                    <Button variant="link" onClick={() => setFilters(prev => ({ ...prev, status: 'all', priority: 'all', q: '' }))}>
                      Resetta filtri
                    </Button>
                  </div>
                ) : (
                  <>
                    {filters.scope === "assigned" ? (
                      <div className="p-4 bg-muted/10 border-b border-border/40">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <ListChecks className="h-4 w-4" /> Subtask assegnate a me
                          </div>
                          <Badge variant="secondary">{assignedSubtasks.length}</Badge>
                        </div>

                        {loadingSubtasks ? (
                          <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento subtask…
                          </div>
                        ) : assignedSubtasks.length === 0 ? (
                          <div className="mt-2 text-sm text-muted-foreground">Nessuna subtask assegnata.</div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {assignedSubtasks.slice(0, 5).map((s) => (
                              <div
                                key={s.id}
                                className="group flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/50 hover:border-primary/20 transition-all cursor-pointer"
                                onClick={() => openTaskDetail({ taskId: s.taskId, subtaskId: s.id })}
                              >
                                <div className="min-w-0">
                                  <div className="font-medium truncate text-sm group-hover:text-primary transition-colors">
                                    ↳ {s.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {s.task?.project?.name || ""} • {s.task?.title || ""}
                                    {s.dueDate ? ` • Due: ${new Date(s.dueDate).toLocaleDateString()}` : ""}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 uppercase">
                                    Subtask
                                  </Badge>
                                  <Badge variant="outline" className="uppercase text-[10px] h-5 px-1.5 bg-background text-foreground/80">
                                    {String(s.status || "").replace("_", " ")}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            {assignedSubtasks.length > 5 ? (
                              <div className="text-xs text-muted-foreground">
                                +{assignedSubtasks.length - 5} altre subtask (usa filtri per restringere)
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}
                    {tasks.map((t) => (
                      <div
                        key={t.id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/30 transition-all cursor-pointer"
                        onClick={() => openTaskDetail({ taskId: t.id })}
                      >
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                          <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ${
                            t.status === 'done' ? 'bg-green-500' : 
                            t.status === 'in_progress' ? 'bg-blue-500' : 
                            t.status === 'archived' ? 'bg-gray-500' : 'bg-orange-500'
                          }`} />
                          
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-base">
                                {t.title}
                              </h3>
                              {t.project?.name && (
                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-muted/50 border-transparent">
                                  {t.project.name}
                                </Badge>
                              )}
                            </div>
                            
                            {t.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 pr-4">{t.description}</p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1.5">
                              {t.dueDate && (
                                <span className={`flex items-center gap-1.5 ${
                                  new Date(t.dueDate) < new Date() && t.status !== 'done' ? 'text-red-500 font-medium' : ''
                                }`}>
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(t.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              
                              <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                                {(t._count?.subtasks || 0) > 0 && (
                                  <div className="flex items-center gap-1">
                                    <ListChecks className="w-3.5 h-3.5" /> {t._count.subtasks}
                                  </div>
                                )}
                                {(t._count?.attachments || 0) > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Paperclip className="w-3.5 h-3.5" /> {t._count.attachments}
                                  </div>
                                )}
                                {(t._count?.comments || 0) > 0 && (
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-3.5 h-3.5" /> {t._count.comments}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-3 sm:mt-0 pl-7 sm:pl-0 shrink-0">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-2">
                              {t.priority !== 'medium' && (
                                <Badge variant="outline" className={`uppercase text-[10px] h-5 px-1.5 border ${
                                  t.priority === 'high' ? 'text-red-500 border-red-500/30 bg-red-500/5' : 'text-green-500 border-green-500/30 bg-green-500/5'
                                }`}>
                                  {t.priority}
                                </Badge>
                              )}
                              <Badge variant="outline" className="uppercase text-[10px] h-5 px-1.5 bg-background text-foreground/80">
                                {t.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            {t.assignees.length > 0 && (
                              <div className="flex -space-x-2">
                                {t.assignees.slice(0, 3).map((a) => (
                                  <Avatar key={a.userId} className="h-6 w-6 border-2 border-background">
                                    <AvatarImage src={a.user.image || undefined} />
                                    <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                                      {initials(a.user)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {t.assignees.length > 3 && (
                                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] text-muted-foreground font-medium">
                                    +{t.assignees.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {tasks.length > 0 && tasks.length < total ? (
                      <div className="p-4 flex justify-center border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loadingMore}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={async () => {
                            setLoadingMore(true);
                            try {
                              await fetchTasksPage({ page: page + 1, append: true });
                            } finally {
                              setLoadingMore(false);
                            }
                          }}
                        >
                          {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                          Carica altre ({total - tasks.length})
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <CreateTaskGlobalDialog
          open={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          onSuccess={() => {
            // reload tasks after create (queryString already reflects filters)
            fetchTasksPage({ page: 1, append: false }).catch(() => {});
          }}
          defaultProjectId={filters.projectId !== "all" ? filters.projectId : undefined}
        />

        {selectedTaskId ? (
          <TaskDetailModal
            open={true}
            onClose={() => {
              setSelectedTaskId(null);
              setSelectedSubtaskId(null);
              if (searchParams?.get("taskId") || searchParams?.get("subtaskId")) {
                const params = new URLSearchParams(searchParams?.toString() || "");
                params.delete("taskId");
                params.delete("subtaskId");
                const qs = params.toString();
                router.replace(qs ? `/tasks?${qs}` : "/tasks");
              }
            }}
            taskId={selectedTaskId}
            projectId={"_global"}
            initialSubtaskId={selectedSubtaskId || undefined}
            onUpdate={() => {
              // refresh list after edits
              fetchTasksPage({ page: 1, append: false }).catch(() => {});
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

