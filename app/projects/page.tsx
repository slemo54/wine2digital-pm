"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Plus, Trash2, Archive, ChevronLeft, ChevronRight, SortAsc, SortDesc } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  startDate?: string | null;
  endDate?: string | null;
  creator?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  members: Array<{
    user: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      name?: string | null;
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

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

type OrderBy = "name" | "status" | "createdAt" | "completionRate";
type Order = "asc" | "desc";

export default function ProjectsPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & sorting from URL
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const orderBy = (searchParams.get("orderBy") || "createdAt") as OrderBy;
  const order = (searchParams.get("order") || "desc") as Order;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "10");
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (orderBy) params.set("orderBy", orderBy);
    if (order) params.set("order", order);
    return params.toString();
  }, [page, search, statusFilter, startDate, endDate, orderBy, order]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, queryString]);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects?${queryString}`);
      if (!response.ok) {
        throw new Error("Failed to load projects");
      }
      const data = await response.json();
      setProjects(data?.projects || []);
      setPagination(data?.pagination || null);
      setSelectedProjects(new Set());
    } catch (err) {
      setError("Impossibile caricare i progetti");
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuery = (updates: Record<string, string | number | undefined | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    params.set("page", "1"); // reset page on filter changes
    router.push(`/projects?${params.toString()}`);
  };

  const handleSort = (column: OrderBy) => {
    if (orderBy === column) {
      updateQuery({ order: order === "asc" ? "desc" : "asc", orderBy: column });
    } else {
      updateQuery({ orderBy: column, order: "asc" });
    }
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/projects?${params.toString()}`);
  };

  const getInitials = (name?: string | null, firstName?: string | null, lastName?: string | null) => {
    if (name) {
      const names = name.split(" ");
      return names?.map((n) => n?.[0] || "").join("").toUpperCase().slice(0, 2) || "U";
    }
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return "U";
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      running: { label: "Running", className: "bg-blue-100 text-blue-700 border-blue-200" },
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

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isAllSelected = projects.length > 0 && selectedProjects.size === projects.length;

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedProjects(new Set(projects.map((p) => p.id)));
    else setSelectedProjects(new Set());
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedProjects);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedProjects(next);
  };

  const bulkAction = async (action: "archive" | "delete") => {
    if (selectedProjects.size === 0) return;
    setIsBulkLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedProjects), action }),
      });
      if (!response.ok) throw new Error("Bulk action failed");
      toast.success(action === "archive" ? "Progetti archiviati" : "Progetti eliminati");
      await fetchProjects();
    } catch (err) {
      toast.error("Impossibile completare l'azione");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const columns = [
    { key: "name", label: "Project name", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "owner", label: "Owner", sortable: false },
    { key: "start", label: "Start date", sortable: true },
    { key: "end", label: "End date", sortable: true },
    { key: "completionRate", label: "Completion", sortable: true },
    { key: "description", label: "Description", sortable: false },
    { key: "users", label: "Users", sortable: false },
  ] as const;

  const sortIcon = (col: OrderBy) => {
    if (orderBy !== col) return <SortAsc className="h-3.5 w-3.5 text-gray-400" />;
    return order === "asc" ? (
      <SortAsc className="h-3.5 w-3.5 text-gray-600" />
    ) : (
      <SortDesc className="h-3.5 w-3.5 text-gray-600" />
    );
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
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-foreground">Project List</h1>
            <p className="text-muted-foreground mt-1">These companies have purchased in the last 12 months.</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="Search by name or description"
                defaultValue={search}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateQuery({ search: (e.target as HTMLInputElement).value });
                  }
                }}
              />
            </div>
            <div>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => updateQuery({ status: e.target.value })}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => updateQuery({ startDate: e.target.value })}
              />
            </div>
            <div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => updateQuery({ endDate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bulk actions */}
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedProjects.size === 0 || isBulkLoading}
            onClick={() => bulkAction("archive")}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive selected
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedProjects.size === 0 || isBulkLoading}
            onClick={() => bulkAction("delete")}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete selected
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedProjects.size} selected
          </span>
        </div>

        {/* Projects Table */}
        <Card className="bg-white">
          <CardContent className="p-0">
            {error && (
              <div className="p-4 text-sm text-destructive">{error}</div>
            )}
            {projects.length === 0 && !error ? (
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={isAllSelected}
                            onChange={(e) => toggleSelectAll(e.target.checked)}
                          />
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                          >
                            <button
                              type="button"
                              className={cn(
                                "flex items-center gap-1",
                                col.sortable ? "hover:text-foreground text-muted-foreground" : "text-muted-foreground cursor-default"
                              )}
                              onClick={col.sortable ? () => handleSort(col.key as OrderBy) : undefined}
                              disabled={!col.sortable}
                            >
                              {col.label}
                              {col.sortable && sortIcon(col.key as OrderBy)}
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projects.map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={selectedProjects.has(project.id)}
                              onChange={(e) => toggleSelect(project.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <Link href={`/project/${project.id}`} className="hover:underline">
                              <div className="text-sm font-medium text-foreground">
                                {project.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Created: {formatDate(project.createdAt)}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-top">
                            {getStatusBadge(project.status)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-top">
                            <div className="text-sm text-foreground">
                              {project.creator?.name ||
                                `${project.creator?.firstName || ""} ${project.creator?.lastName || ""}`.trim() ||
                                project.creator?.email ||
                                "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {project.creator?.email || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-top">
                            <div className="text-sm text-foreground">{formatDate(project.startDate)}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-top">
                            <div className="text-sm text-foreground">{formatDate(project.endDate)}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-top">
                            <div className="flex items-center gap-2">
                              <div className="w-24">
                                <Progress value={project.completionRate} className="h-2" />
                              </div>
                              <span className="text-sm text-foreground font-medium min-w-[3rem]">
                                {project.completionRate}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {project.tasksCompleted}/{project.tasksTotal} tasks
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="text-sm text-foreground line-clamp-2 max-w-xs">
                              {project.description || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-top">
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
                          <td className="px-4 py-4 whitespace-nowrap text-right align-top">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  toast.error("Delete single not yet implemented");
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
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
                      onClick={() => handlePageChange(page - 1)}
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
                        } else if (page <= 5) {
                          pageNum = i + 1;
                        } else if (page >= pagination.totalPages - 4) {
                          pageNum = pagination.totalPages - 9 + i;
                        } else {
                          pageNum = page - 4 + i;
                        }

                        if (i > 0 && i < 9 && pagination.totalPages > 10) {
                          if (
                            (page <= 5 && pageNum === 6) ||
                            (page >= pagination.totalPages - 4 && pageNum === pagination.totalPages - 5) ||
                            (pageNum === page - 5 || pageNum === page + 5)
                          ) {
                            return <span key={i} className="px-2">...</span>;
                          }
                        }

                        return (
                          <Button
                            key={`${pageNum}-${i}`}
                            variant={page === pageNum ? "default" : "outline"}
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
                      onClick={() => handlePageChange(page + 1)}
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
