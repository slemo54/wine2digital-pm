"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Loader2, Search, Calendar, Paperclip, MessageCircle, ListChecks } from "lucide-react";

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

export default function TasksPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
    if (status !== "authenticated") return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/projects");
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

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("scope", filters.scope);
    if (filters.status && filters.status !== "all") sp.set("status", filters.status);
    if (filters.priority && filters.priority !== "all") sp.set("priority", filters.priority);
    if (filters.projectId && filters.projectId !== "all") sp.set("projectId", filters.projectId);
    if (filters.dueFrom) sp.set("dueFrom", filters.dueFrom);
    if (filters.dueTo) sp.set("dueTo", filters.dueTo);
    if (filters.q.trim()) sp.set("q", filters.q.trim());
    if (filters.tag.trim()) sp.set("tag", filters.tag.trim());
    sp.set("page", "1");
    sp.set("pageSize", "100");
    return sp.toString();
  }, [filters]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    setLoadingList(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks?${queryString}`);
        const data = await res.json();
        const list = Array.isArray(data.tasks) ? (data.tasks as TaskListItem[]) : [];
        if (!cancelled) setTasks(list);
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [status, queryString]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
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
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Tutte le mie task</h1>
                  <p className="text-sm text-muted-foreground">
                    Filtra per status, priorità, progetto, scadenza, testo e tag. Clicca una task per aprire i dettagli.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={filters.q}
                      onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                      placeholder="Cerca per titolo o descrizione…"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Select value={filters.scope} onValueChange={(v) => setFilters((f) => ({ ...f, scope: v as any }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="assigned">Assegnate a me</SelectItem>
                      <SelectItem value="projects">Nei miei progetti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti gli status</SelectItem>
                      <SelectItem value="todo">Da fare</SelectItem>
                      <SelectItem value="in_progress">In corso</SelectItem>
                      <SelectItem value="done">Completate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priorità" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le priorità</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="low">Bassa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-3">
                  <Select value={filters.projectId} onValueChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Progetto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i progetti</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={filters.dueFrom}
                      onChange={(e) => setFilters((f) => ({ ...f, dueFrom: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Input
                    type="date"
                    value={filters.dueTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dueTo: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    value={filters.tag}
                    onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
                    placeholder="Tag (es. Homepage)"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="p-0">
            <ScrollArea className="h-[70vh]">
              <div className="divide-y">
                {loadingList ? (
                  <div className="p-6 flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento task…
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">Nessuna task trovata con i filtri correnti.</div>
                ) : (
                  tasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={getStatusBadge(t.status)}>
                              {t.status === "todo" && "Da fare"}
                              {t.status === "in_progress" && "In corso"}
                              {t.status === "done" && "Done"}
                              {!["todo", "in_progress", "done"].includes(t.status) && t.status}
                            </Badge>
                            <Badge variant="outline" className={getPriorityBadge(t.priority)}>
                              {t.priority}
                            </Badge>
                            <span className="text-xs text-muted-foreground">• {t.project?.name}</span>
                          </div>

                          <div className="mt-1 font-semibold truncate">{t.title}</div>
                          {t.description ? (
                            <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</div>
                          ) : null}

                          <div className="mt-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {t.dueDate ? (
                                <span className="text-xs text-muted-foreground">
                                  Scadenza: {new Date(t.dueDate).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Senza scadenza</span>
                              )}
                              {parseTags(t.tags).slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <div className="flex items-center gap-3 text-muted-foreground">
                              <div className="flex items-center gap-1 text-xs">
                                <ListChecks className="h-3.5 w-3.5" />
                                <span>{t._count?.subtasks ?? 0}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <Paperclip className="h-3.5 w-3.5" />
                                <span>{t._count?.attachments ?? 0}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>{t._count?.comments ?? 0}</span>
                              </div>
                              <div className="flex -space-x-2">
                                {t.assignees.slice(0, 4).map((a) => (
                                  <Avatar key={a.user.id} className="h-7 w-7 border">
                                    <AvatarImage src={a.user.image || undefined} />
                                    <AvatarFallback className="text-[10px]">{initials(a.user)}</AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {selectedTaskId ? (
          <TaskDetailModal
            open={true}
            onClose={() => setSelectedTaskId(null)}
            taskId={selectedTaskId}
            projectId={"_global"}
            onUpdate={() => {
              // refresh list after edits
              fetch(`/api/tasks?${queryString}`)
                .then((r) => r.json())
                .then((d) => setTasks(Array.isArray(d.tasks) ? d.tasks : tasks))
                .catch(() => {});
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

