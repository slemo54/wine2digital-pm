"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, CalendarDays, Folder, CheckSquare, Bell, Activity } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { CreateTaskGlobalDialog } from "@/components/create-task-global-dialog";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { markAllRead, markNotificationRead } from "@/lib/notifications-client";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  members: any[];
  _count: {
    tasks: number;
  };
}

type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  project: { id: string; name: string };
};

type SubtaskListItem = {
  id: string;
  taskId: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  task: { id: string; title: string; project: { id: string; name: string } };
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  type: string;
  createdAt: string;
  actor: { id: string; email: string; name: string | null; firstName: string | null; lastName: string | null; image: string | null } | null;
  message: string;
  task: { id: string; title: string; projectId: string; projectName: string };
  href: string;
};

export default function DashboardPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

  const [myTasks, setMyTasks] = useState<TaskListItem[]>([]);
  const [mySubtasks, setMySubtasks] = useState<SubtaskListItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);

  useEffect(() => {
    const taskParam = searchParams?.get("taskId");
    const subtaskParam = searchParams?.get("subtaskId");
    if (taskParam) {
      setSelectedTaskId(taskParam);
      setSelectedSubtaskId(subtaskParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProjects();
      fetchMyTasks();
      fetchMySubtasks();
      fetchNotifications();
      fetchActivity();
    }
  }, [status]);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data?.projects || []);
    } catch (error) {
      toast.error("Failed to load projects");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const fetchMyTasks = async () => {
    try {
      // Keep this aligned with /tasks?scope=assigned (pageSize=100)
      const response = await fetch("/api/tasks?scope=assigned&page=1&pageSize=100");
      const data = await response.json();
      setMyTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch {
      setMyTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const fetchMySubtasks = async () => {
    try {
      // Keep this aligned with /tasks?scope=assigned subtasks fetch (pageSize=100)
      const response = await fetch("/api/subtasks?scope=assigned&page=1&pageSize=100");
      const data = await response.json();
      setMySubtasks(Array.isArray(data?.subtasks) ? data.subtasks : []);
    } catch {
      setMySubtasks([]);
    } finally {
      setIsLoadingSubtasks(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json();
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number.isFinite(data?.unreadCount) ? data.unreadCount : 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const openNotification = async (n: NotificationItem) => {
    if (!n?.link) return;
    try {
      const r = await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      if (typeof r.unreadCount === "number") setUnreadCount(r.unreadCount);
      else if (!n.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
    } finally {
      router.push(n.link);
    }
  };

  const fetchActivity = async () => {
    try {
      const response = await fetch("/api/activity");
      const data = await response.json();
      setActivityEvents(Array.isArray(data?.events) ? data.events : []);
    } catch {
      setActivityEvents([]);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleProjectCreated = () => {
    fetchProjects();
    setShowCreateDialog(false);
  };

  const handleTaskCreated = () => {
    fetchMyTasks();
    fetchMySubtasks();
    fetchProjects();
    fetchNotifications();
    fetchActivity();
    setShowCreateTaskDialog(false);
  };

  if (status === "loading" || isLoadingProjects) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getFirstName = () => {
    const name = session?.user?.name || "";
    return name.split(" ")[0] || "User";
  };

  const now = new Date();
  const isOverdue = (t: { dueDate: string | null; status: string }) =>
    !!t.dueDate && new Date(t.dueDate).getTime() < now.getTime() && t.status !== "done";
  const isDueSoon = (t: { dueDate: string | null; status: string }) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    const diffDays = (due - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7 && t.status !== "done";
  };

  const workItems = [
    ...myTasks.map((t) => ({
      kind: "task" as const,
      taskId: t.id,
      subtaskId: null as string | null,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectName: t.project?.name || "",
      taskTitle: t.title,
    })),
    ...mySubtasks.map((s) => ({
      kind: "subtask" as const,
      taskId: s.taskId,
      subtaskId: s.id,
      title: s.title,
      status: s.status,
      priority: s.priority,
      dueDate: s.dueDate,
      projectName: s.task?.project?.name || "",
      taskTitle: s.task?.title || "",
    })),
  ];

  const orderedWorkItems = [...workItems].sort((a, b) => {
    const aScore = (isOverdue(a) ? 100 : 0) + (isDueSoon(a) ? 50 : 0) + (a.priority === "high" ? 10 : 0);
    const bScore = (isOverdue(b) ? 100 : 0) + (isDueSoon(b) ? 50 : 0) + (b.priority === "high" ? 10 : 0);
    return bScore - aScore;
  });

  const actorLabel = (a: ActivityEvent["actor"]) => {
    if (!a) return "Qualcuno";
    const full = (a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim()).trim();
    return full || a.email;
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              {getGreeting()}, {getFirstName()}
            </h1>
            <p className="text-muted-foreground">Your workspace: focus on what needs attention now.</p>
          </div>
          <Button
            onClick={() => setShowCreateTaskDialog(true)}
            className="bg-black text-white hover:bg-black/90 rounded-lg px-6 w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crea Task
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-12">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                onClick={() => setShowCreateTaskDialog(true)}
                className="h-auto py-4 flex flex-col items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white border-none shadow-lg shadow-orange-900/20"
              >
                <Plus className="h-6 w-6" />
                <span className="font-semibold">Create Task</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(true)}
                className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent border-border shadow-sm"
              >
                <Folder className="h-6 w-6 text-blue-500" />
                <span>Create Project</span>
              </Button>

              <Link href="/calendar" className="contents">
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent border-border shadow-sm"
                >
                  <CalendarDays className="h-6 w-6 text-purple-500" />
                  <span>Calendar</span>
                </Button>
              </Link>

              <Link href="/tasks?scope=assigned" className="contents">
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent border-border shadow-sm"
                >
                  <CheckSquare className="h-6 w-6 text-green-500" />
                  <span>My Tasks</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* My Tasks & Notifications Grid */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-border/50 bg-card/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-lg">My Tasks</CardTitle>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {orderedWorkItems.filter(isOverdue).length} overdue • {orderedWorkItems.filter(isDueSoon).length} due soon
                  </div>
                  <Link href="/tasks?scope=assigned" className="text-xs text-primary hover:underline">
                    View all &rarr;
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {isLoadingTasks || isLoadingSubtasks ? (
                  <div className="text-sm text-muted-foreground flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading tasks…
                  </div>
                ) : orderedWorkItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center bg-muted/20 rounded-lg border border-dashed">
                    No assigned tasks/subtasks yet.
                  </div>
                ) : (
                  orderedWorkItems.slice(0, 5).map((t) => (
                    <div
                      key={`${t.kind}:${t.subtaskId || t.taskId}`}
                      className="group flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/50 hover:border-primary/20 transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedTaskId(t.taskId);
                        setSelectedSubtaskId(t.subtaskId);
                        const params = new URLSearchParams(searchParams?.toString() || "");
                        params.set("taskId", t.taskId);
                        if (t.subtaskId) params.set("subtaskId", t.subtaskId);
                        else params.delete("subtaskId");
                        router.push(`/dashboard?${params.toString()}`);
                      }}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-1 h-2 w-2 rounded-full ${isOverdue(t) ? 'bg-red-500' : 'bg-blue-500'}`} />
                        <div className="min-w-0">
                          <div className="font-medium truncate text-sm text-foreground group-hover:text-primary transition-colors">
                            {t.kind === "subtask" ? `↳ ${t.title}` : t.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {t.kind === "subtask" ? `${t.projectName} • ${t.taskTitle}` : t.projectName}
                            {t.dueDate && ` • Due: ${new Date(t.dueDate).toLocaleDateString()}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOverdue(t) && (
                          <Badge variant="destructive" className="text-[10px] h-5 px-1.5 uppercase">Overdue</Badge>
                        )}
                        {t.kind === "subtask" ? (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 uppercase">
                            Subtask
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 uppercase bg-muted/50 border-border">
                          {t.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Activity */}
            <Card className="border-border/50 bg-card/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-foreground" />
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {isLoadingActivity ? (
                  <div className="text-sm text-muted-foreground flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
                  </div>
                ) : activityEvents.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">No recent activity.</div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-border/50 pl-6">
                    {activityEvents.slice(0, 5).map((e) => (
                      <div key={e.id} className="relative">
                        <div className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full bg-primary border-4 border-background" />
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <p className="text-sm">
                              <span className="font-semibold text-primary">{actorLabel(e.actor)}</span> <span className="text-muted-foreground">{e.message}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {e.task.projectName} • {e.task.title}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Right: Notifications */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-border/50 bg-card/50 shadow-sm h-full">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-lg">Notifications</CardTitle>
                  </div>
                  {unreadCount > 0 && (
                    <Badge variant="default" className="bg-orange-600 hover:bg-orange-700 text-white border-none">
                      {unreadCount} UNREAD
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {isLoadingNotifications ? (
                  <div className="text-sm text-muted-foreground flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">All caught up!</div>
                ) : (
                  <div className="space-y-3">
                    {notifications.slice(0, 5).map((n) => (
                      <div key={n.id} className={`p-3 rounded-lg border ${n.isRead ? 'bg-muted/20 border-transparent' : 'bg-card border-l-2 border-l-orange-500 border-y border-r border-border shadow-sm'}`}>
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="font-semibold text-sm line-clamp-1">{n.title}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{n.message}</p>
                        {n.link && (
                          <div className="flex justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-[10px] text-orange-500 hover:text-orange-600 px-2"
                              onClick={() => void openNotification(n)}
                            >
                              Open &rarr;
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <Button 
                      variant="outline" 
                      className="w-full mt-2 border-dashed border-border text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          await markAllRead();
                          fetchNotifications();
                        } catch {}
                      }}
                      disabled={unreadCount === 0}
                    >
                      Mark all as read
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={handleProjectCreated}
      />

      <CreateTaskGlobalDialog
        open={showCreateTaskDialog}
        onClose={() => setShowCreateTaskDialog(false)}
        onSuccess={handleTaskCreated}
      />

      {selectedTaskId && (
        <TaskDetailModal
          open={true}
          onClose={() => {
            setSelectedTaskId(null);
            setSelectedSubtaskId(null);
            // Pulisce l'URL se era stato aperto via deep link
            const params = new URLSearchParams(window.location.search);
            if (params.has("taskId") || params.has("subtaskId")) {
              router.replace("/dashboard");
            }
          }}
          taskId={selectedTaskId}
          initialSubtaskId={selectedSubtaskId || undefined}
          onUpdate={() => {
            fetchMyTasks();
            fetchMySubtasks();
            fetchActivity();
          }}
        />
      )}
    </div>
  );
}
