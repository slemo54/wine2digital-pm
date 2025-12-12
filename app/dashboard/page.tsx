"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Folder, Calendar, Users, Loader2, LogOut, CalendarDays, FolderOpen, FileText, Bell, Search, MoreHorizontal } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
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

export default function DashboardPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      setIsLoading(false);
    }
  };

  const handleProjectCreated = () => {
    fetchProjects();
    setShowCreateDialog(false);
  };

  const handleTaskCreated = () => {
    // dashboard shows projects summary; refresh projects counts if needed
    fetchProjects();
    setShowCreateTaskDialog(false);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names?.map(n => n?.[0] || "").join("").toUpperCase().slice(0, 2) || "U";
  };

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

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="border-b border-border bg-background text-foreground sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Folder className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold">Wine2Digital</span>
            </div>
            
            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link href="/dashboard" className="px-4 py-2 rounded-md bg-accent font-medium">
                Dashboard
              </Link>
              <Link href="/projects" className="px-4 py-2 rounded-md text-muted-foreground hover:text-foreground">
                Progetti
              </Link>
              <Link href="/tasks" className="px-4 py-2 rounded-md text-muted-foreground hover:text-foreground">
                Task
              </Link>
              <Link href="/calendar" className="px-4 py-2 rounded-md text-muted-foreground hover:text-foreground">
                Calendario
              </Link>
              <Link href="/files" className="px-4 py-2 rounded-md text-muted-foreground hover:text-foreground">
                File
              </Link>
              <Link href="/profile" className="px-4 py-2 rounded-md text-muted-foreground hover:text-foreground">
                Profilo
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-white text-xs">
                  {getInitials(session?.user?.name)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => signOut({ callbackUrl: "/auth/login" })}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Greeting Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                {getGreeting()}, {getFirstName()}
              </h1>
              <p className="text-muted-foreground">
                Stay on top of your tasks, monitor progress, and track status.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateTaskDialog(true)}
              className="bg-black text-white hover:bg-black/90 rounded-lg px-6"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crea Task
            </Button>
          </div>

          {/* Alert Banner */}
          <div className="mt-6 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <span className="font-semibold">Welcome to Wine2Digital PM!</span> Stay organized with your projects, tasks, and team collaboration.
              </p>
            </div>
          </div>
        </div>

        {/* Projects/Folders Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Projects</h3>
          </div>

          {projects?.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Folder className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-6">Get started by creating your first project</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects?.map((project) => (
                <Link key={project?.id} href={`/project/${project?.id}`}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer border bg-white group">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                          <FolderOpen className="w-6 h-6 text-foreground" />
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <p className="font-semibold text-lg text-foreground mb-1">
                          {(project?._count?.tasks || 0) + (project?.members?.length || 0)} Files
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {project?.name || "Untitled Project"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/calendar" className="flex-1">
            <Button variant="outline" className="w-full justify-start rounded-lg h-12 bg-white">
              <CalendarDays className="mr-2 h-5 w-5" />
              Calendar
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="flex-1 justify-start rounded-lg h-12 bg-white"
            onClick={() => setShowCreateDialog(true)}
          >
            <Folder className="mr-2 h-5 w-5" />
            Create Project
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 justify-start rounded-lg h-12 bg-white"
            onClick={() => {
              if (projects.length > 0) {
                router.push(`/project/${projects[0].id}`);
              } else {
                toast.error("No projects available. Create one first!");
              }
            }}
          >
            <FileText className="mr-2 h-5 w-5" />
            View Projects
          </Button>
        </div>

        {/* Task Status Overview */}
        {projects?.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Not Started */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Not Started
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* In Progress */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive"></div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      In Progress
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Under Review */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-info"></div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Under Review
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Completed */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success"></div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Completed
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </div>
        )}
      </main>

      {/* Create Project Dialog */}
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
