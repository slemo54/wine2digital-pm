"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Calendar, Users, Loader2, Settings, LogOut, Briefcase } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import { ProjectTaskLists } from "@/components/project-task-lists";
import { ProjectChat } from "@/components/project-chat";
import { ProjectFiles } from "@/components/project-files";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectMembersPanel } from "@/components/project-members-panel";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { CustomFieldDefinitionsManager } from "@/components/custom-fields/CustomFieldDefinitionsManager";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  creator: any;
  members: any[];
  tasks: any[];
}

export default function ProjectPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  const searchParams = useSearchParams();
  const taskFromSearch = searchParams?.get("task");
  const [tabFromHash, setTabFromHash] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setTabFromHash(window.location.hash.replace("#", ""));
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const sessionGlobalRole = (session?.user as any)?.role as string | undefined;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && projectId) {
      fetchProject();
    }
  }, [status, projectId]);

  const fetchProject = async () => {
    // Prevent concurrent fetches
    if (isFetching) return;

    setIsFetching(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load project");
      }

      setProject(data?.project);
    } catch (error) {
      toast.error("Failed to load project");
      if (isLoading) {
        router.push("/dashboard");
      }
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names?.map(n => n?.[0] || "").join("").toUpperCase().slice(0, 2) || "U";
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-background dark:via-background dark:to-background">
      {/* Project Info */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <p className="text-gray-900">{project?.description || "No description provided"}</p>
              </div>
              {(project?.startDate || project?.endDate) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Timeline</h3>
                  <div className="flex items-center text-gray-900">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>
                      {project?.startDate && new Date(project.startDate).toLocaleDateString()}
                      {project?.startDate && project?.endDate && " - "}
                      {project?.endDate && new Date(project.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Team</h3>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center min-w-0">
                    <Users className="mr-2 h-4 w-4 text-gray-900" />
                    <div className="flex -space-x-2">
                      {project?.members?.slice(0, 5)?.map((member) => (
                        <Avatar key={member?.id} className="h-8 w-8 border-2 border-white">
                          <AvatarFallback className="bg-blue-600 text-white text-xs">
                            {getInitials(
                              `${member?.user?.name || ""} ${member?.user?.firstName || ""} ${member?.user?.lastName || ""}`.trim()
                            )}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {(project?.members?.length || 0) > 5 && (
                        <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">+{project.members.length - 5}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <ProjectMembersPanel
                    projectId={project.id}
                    members={project.members || []}
                    sessionUserId={sessionUserId || null}
                    sessionGlobalRole={sessionGlobalRole || null}
                    onChanged={fetchProject}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Tabs */}
        <Tabs defaultValue={tabFromHash === "files" ? "files" : "tasks"} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:w-[650px]">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="wiki">Wiki</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Tasks</h2>
            <ProjectTaskLists
              projectId={project.id}
              sessionUserId={sessionUserId || null}
              sessionGlobalRole={sessionGlobalRole || null}
              projectMembers={project.members || []}
            />
          </TabsContent>

          <TabsContent value="chat">
            <ProjectChat projectId={project?.id} />
          </TabsContent>

          <TabsContent value="files">
            <ProjectFiles projectId={project?.id} />
          </TabsContent>

          <TabsContent value="wiki" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Wiki</h2>
              <Link href={`/project/${project?.id}/wiki`}>
                <Button>Apri Wiki</Button>
              </Link>
            </div>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600">
                  Documentazione del progetto: pagine editabili con storico revisioni.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <CustomFieldDefinitionsManager projectId={project.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {taskFromSearch ? (
          <TaskDetailModal
            open={true}
            onClose={() => router.replace(`/project/${projectId}`)}
            taskId={taskFromSearch}
            projectId={projectId}
            onUpdate={fetchProject}
          />
        ) : null}
      </div>
    </div >
  );
}
