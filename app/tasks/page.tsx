"use client";

import { useEffect, useState } from "react";
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
import { useTasksList, useAssignedSubtasks, useProjectsForFilter } from "@/hooks/use-tasks-list";

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

  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
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

  // React Query hooks
  const { data: tasksData, isLoading: loadingList } = useTasksList({
    ...filters,
    page,
    pageSize,
  });
  const { data: subtasksData, isLoading: loadingSubtasks } = useAssignedSubtasks(filters);
  const { data: projectsData } = useProjectsForFilter();

  // Extract data
  const tasks: TaskListItem[] = tasksData?.tasks || [];
  const total = tasksData?.total || 0;
  const assignedSubtasks: SubtaskListItem[] = subtasksData?.subtasks || [];
  const projects: ProjectLite[] = projectsData?.projects || [];

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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.scope, filters.status, filters.priority, filters.projectId, filters.dueFrom, filters.dueTo, filters.q, filters.tag]);

  const openTaskDetail = (opts: { taskId: string; subtaskId?: string | null }) => {
    setSelectedTaskId(opts.taskId);
    setSelectedSubtaskId(opts.subtaskId || null);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("taskId", opts.taskId);
    if (opts.subtaskId) params.set("subtaskId", opts.subtaskId);
    else params.delete("subtaskId");
    router.push(`/tasks?${params.toString()}`);
  };

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
                          disabled={loadingList}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setPage((p) => p + 1)}
                        >
                          {loadingList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
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
            // React Query will refetch automatically due to cache invalidation
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
              // React Query will refetch automatically due to cache invalidation
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
