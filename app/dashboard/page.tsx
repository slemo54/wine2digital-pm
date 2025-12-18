"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, CalendarDays, Folder, CheckSquare, Bell, Activity } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { CreateTaskGlobalDialog } from "@/components/create-task-global-dialog";

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

  const [myTasks, setMyTasks] = useState<TaskListItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProjects();
      fetchMyTasks();
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
      const response = await fetch("/api/tasks?scope=assigned&page=1&pageSize=25");
      const data = await response.json();
      setMyTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch {
      setMyTasks([]);
    } finally {
      setIsLoadingTasks(false);
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
    fetchProjects();
    fetchNotifications();
    fetchActivity();
    setShowCreateTaskDialog(false);
  };

  if (status === "loading" || isLoadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
  const isOverdue = (t: TaskListItem) =>
    !!t.dueDate && new Date(t.dueDate).getTime() < now.getTime() && t.status !== "done";
  const isDueSoon = (t: TaskListItem) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    const diffDays = (due - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7 && t.status !== "done";
  };

  const orderedTasks = [...myTasks].sort((a, b) => {
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
    <div className="min-h-screen bg-secondary">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              {getGreeting()}, {getFirstName()}
            </h1>
            <p className="text-muted-foreground">Your workspace: focus on what needs attention now.</p>
          </div>
          <Button onClick={() => setShowCreateTaskDialog(true)} className="bg-black text-white hover:bg-black/90 rounded-lg px-6">
            <Plus className="mr-2 h-4 w-4" />
            Crea Task
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* My Tasks */}
          <Card className="bg-white lg:col-span-8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">My Tasks</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {orderedTasks.filter(isOverdue).length} overdue • {orderedTasks.filter(isDueSoon).length} due soon
                  </div>
                </div>
                <Link href="/tasks">
                  <Button variant="outline" size="sm">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingTasks ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
                </div>
              ) : orderedTasks.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6">
                  No assigned tasks yet. Use “Crea Task” to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {orderedTasks.slice(0, 8).map((t) => (
                    <div key={t.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{t.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{t.project?.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOverdue(t) ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : isDueSoon(t) ? (
                            <Badge variant="secondary">Due soon</Badge>
                          ) : null}
                          <Badge variant="outline" className="capitalize">
                            {t.status}
                          </Badge>
                        </div>
                      </div>
                      {t.dueDate ? (
                        <div className="mt-2 text-xs text-muted-foreground">Due: {new Date(t.dueDate).toLocaleDateString()}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="bg-white lg:col-span-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <CardTitle className="text-base">Notifications</CardTitle>
                </div>
                <Badge variant={unreadCount > 0 ? "default" : "secondary"}>{unreadCount} unread</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingNotifications ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6">No notifications yet.</div>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 6).map((n) => (
                    <div key={n.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`font-medium text-sm ${n.isRead ? "text-muted-foreground" : ""}`}>{n.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                        </div>
                        {!n.isRead ? <Badge variant="outline">New</Badge> : null}
                      </div>
                      {n.link ? (
                        <div className="mt-2">
                          <Link href={n.link}>
                            <Button variant="link" className="h-auto p-0 text-xs">
                              Open
                            </Button>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/notifications", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ markAllRead: true }),
                        });
                        if (!res.ok) throw new Error("Failed");
                        fetchNotifications();
                      } catch {
                        toast.error("Failed to mark all read");
                      }
                    }}
                    disabled={unreadCount === 0}
                  >
                    Mark all as read
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Button className="w-full justify-start" onClick={() => setShowCreateTaskDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create task
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowCreateDialog(true)}>
                <Folder className="h-4 w-4 mr-2" />
                Create project
              </Button>
              <Link href="/calendar" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Calendar
                </Button>
              </Link>
              <Link href="/projects" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Folder className="h-4 w-4 mr-2" />
                  Projects
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Activity (placeholder until API is wired) */}
          <Card className="bg-white lg:col-span-8">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <CardTitle className="text-base">Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingActivity ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : activityEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6">No recent activity.</div>
              ) : (
                <div className="space-y-3">
                  {activityEvents.slice(0, 10).map((e) => (
                    <div key={e.id} className="border rounded-lg p-3">
                      <div className="text-sm">
                        <span className="font-medium">{actorLabel(e.actor)}</span> {e.message}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {e.task.projectName ? `${e.task.projectName} • ` : ""}{e.task.title}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </div>
                        <Link href={e.href}>
                          <Button variant="link" className="h-auto p-0 text-xs">
                            Open
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
}
