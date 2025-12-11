"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateProjectDialog } from "@/components/create-project-dialog";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  members: Array<{
    user: {
      id: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      email: string;
    };
  }>;
  completionRate: number;
  tasksCompleted: number;
  tasksTotal: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function ProjectsPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProjects();
    }
  }, [status, currentPage]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects?page=${currentPage}&limit=10`);
      if (!response.ok) {
        throw new Error("Failed to load projects");
      }
      const data = await response.json();
      setProjects(data?.projects || []);
      setPagination(data?.pagination || null);
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

  const handlePageChange = (newPage: number) => {
    router.push(`/projects?page=${newPage}`);
  };

  const getInitials = (name?: string | null, firstName?: string, lastName?: string) => {
    if (name) {
      const names = name.split(" ");
      return names?.map(n => n?.[0] || "").join("").toUpperCase().slice(0, 2) || "U";
    }
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return "U";
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      active: { label: "Running", className: "bg-blue-100 text-blue-700 border-blue-200" },
      completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
      archived: { label: "Archived", className: "bg-gray-100 text-gray-700 border-gray-200" },
      draft: { label: "Draft", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    };
    const statusInfo = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-700 border-gray-200" };
    return (
      <Badge variant="outline" className={statusInfo.className}>
        {statusInfo.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-foreground">Project List</h1>
            <p className="text-muted-foreground mt-1">
              These companies have purchased in the last 12 months.
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </Button>
        </div>

        {/* Projects Table */}
        <Card className="bg-white">
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-muted-foreground mb-4">No projects found</p>
                <Button onClick={() => setShowCreateDialog(true)} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Project
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedProjects.size === projects.length && projects.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProjects(new Set(projects.map(p => p.id)));
                              } else {
                                setSelectedProjects(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Users
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completion rate
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projects.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={selectedProjects.has(project.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedProjects);
                                if (e.target.checked) {
                                  newSelected.add(project.id);
                                } else {
                                  newSelected.delete(project.id);
                                }
                                setSelectedProjects(newSelected);
                              }}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <Link href={`/project/${project.id}`} className="hover:underline">
                              <div className="text-sm font-medium text-foreground">
                                {project.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(project.createdAt)}
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(project.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center -space-x-2">
                              {project.members.slice(0, 4).map((member, idx) => (
                                <Avatar
                                  key={member.user.id}
                                  className="h-8 w-8 border-2 border-white"
                                  style={{ zIndex: project.members.length - idx }}
                                >
                                  <AvatarFallback className="bg-accent text-foreground text-xs">
                                    {getInitials(
                                      member.user.name,
                                      member.user.firstName,
                                      member.user.lastName
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {project.members.length > 4 && (
                                <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600 font-medium">
                                  +{project.members.length - 4}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-24">
                                <Progress value={project.completionRate} className="h-2" />
                              </div>
                              <span className="text-sm text-foreground font-medium min-w-[3rem]">
                                {project.completionRate}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                // TODO: Implement delete functionality
                                toast.error("Delete functionality not yet implemented");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPrev}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => {
                        let pageNum: number;
                        if (pagination.totalPages <= 10) {
                          pageNum = i + 1;
                        } else if (currentPage <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage >= pagination.totalPages - 4) {
                          pageNum = pagination.totalPages - 9 + i;
                        } else {
                          pageNum = currentPage - 4 + i;
                        }

                        if (i > 0 && i < 9 && pagination.totalPages > 10) {
                          if (
                            (currentPage <= 5 && pageNum === 6) ||
                            (currentPage >= pagination.totalPages - 4 && pageNum === pagination.totalPages - 5) ||
                            (pageNum === currentPage - 5 || pageNum === currentPage + 5)
                          ) {
                            return <span key={i} className="px-2">...</span>;
                          }
                        }

                        return (
                          <Button
                            key={i}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="min-w-[2.5rem]"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNext}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
