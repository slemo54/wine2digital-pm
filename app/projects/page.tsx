"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Plus, Trash2, Archive, ChevronLeft, ChevronRight, SortAsc, SortDesc, Pencil, Download } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { cn } from "@/lib/utils";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Project {
  id: string;
  creatorId: string;
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
    userId: string;
    role: string;
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

  const meId = (session?.user as any)?.id as string | undefined;
  const globalRole = String((session?.user as any)?.role || "member");

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const handleProjectCreated = async () => {
    await fetchProjects();
    setShowCreateDialog(false);
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

  const getMyProjectRole = (project: Project): string | null => {
    if (!meId) return null;
    const membership = Array.isArray(project.members)
      ? project.members.find((m) => m?.userId === meId || m?.user?.id === meId) || null
      : null;
    return membership?.role ? String(membership.role) : null;
  };

  const getProjectPermissions = (project: Project) => {
    const myRole = getMyProjectRole(project);
    const isCreator = Boolean(meId) && project.creatorId === meId;
    const isOwner = myRole === "owner";
    const isManager = myRole === "manager";
    const canEdit = globalRole === "admin" || isCreator || isOwner || isManager;
    const canArchive = canEdit;
    const canDelete = globalRole === "admin" || isCreator || isOwner;
    return { myRole, isCreator, isOwner, isManager, canEdit, canArchive, canDelete };
  };

  const getPermissionTooltip = (action: "edit" | "archive" | "delete") => {
    if (action === "delete") return "Solo admin, creator o owner del progetto possono eliminare.";
    if (action === "archive") return "Solo admin, creator o owner/manager del progetto possono archiviare.";
    return "Solo admin, creator o owner/manager del progetto possono modificare.";
  };

  const ActionIconButton = (props: {
    tooltip: string;
    disabled?: boolean;
    onClick?: () => void;
    variant?: "ghost" | "outline" | "destructive";
    className?: string;
    children: ReactNode;
  }) => {
    const { tooltip, disabled, onClick, variant = "ghost", className, children } = props;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={disabled ? "inline-flex cursor-not-allowed" : "inline-flex"}>
            <Button
              type="button"
              variant={variant}
              size="icon"
              className={cn("h-9 w-9", className)}
              disabled={disabled}
              onClick={disabled ? undefined : onClick}
              aria-label={tooltip}
            >
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    );
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
    if (action === "delete") {
      const ok = confirm(`Eliminare definitivamente ${selectedProjects.size} progetti?`);
      if (!ok) return;
    }
    setIsBulkLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedProjects), action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((data as any)?.error || "Bulk action failed"));
      }

      const requested = Number((data as any)?.requested ?? selectedProjects.size) || selectedProjects.size;
      const processed = Number((data as any)?.processed ?? (data as any)?.archived ?? (data as any)?.deleted ?? 0) || 0;
      const unauthorized = Number((data as any)?.unauthorized ?? 0) || 0;

      if (action === "archive") {
        toast.success(
          unauthorized > 0
            ? `Archiviati ${processed}/${requested}. ${unauthorized} non autorizzati.`
            : `Archiviati ${processed} progetti.`
        );
      } else {
        toast.success(
          unauthorized > 0
            ? `Eliminati ${processed}/${requested}. ${unauthorized} non autorizzati.`
            : `Eliminati ${processed} progetti.`
        );
      }
      await fetchProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossibile completare l'azione");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setShowEditDialog(true);
  };

  const handleProjectUpdated = async () => {
    await fetchProjects();
    setShowEditDialog(false);
    setEditingProject(null);
  };

  const archiveSingleProject = async (project: Project) => {
    const perms = getProjectPermissions(project);
    if (!perms.canArchive) {
      toast.error(getPermissionTooltip("archive"));
      return;
    }
    if (project.status === "archived") return;
    const ok = confirm(`Archiviare il progetto "${project.name}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Archive failed"));
      toast.success("Progetto archiviato");
      await fetchProjects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const deleteSingleProject = async (project: Project) => {
    const perms = getProjectPermissions(project);
    if (!perms.canDelete) {
      toast.error(getPermissionTooltip("delete"));
      return;
    }
    const ok = confirm(`Eliminare definitivamente il progetto "${project.name}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Delete failed"));
      toast.success("Progetto eliminato");
      await fetchProjects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const exportProjects = async (format: "csv" | "json") => {
    const total = pagination?.total ?? projects.length;
    if (!total || total <= 0) return;

    const MAX_EXPORT = 5000;
    if (total > MAX_EXPORT) {
      toast.error(`Troppi progetti da esportare (${total}). Applica filtri e riprova.`);
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams(queryString);
      params.set("page", "1");
      params.set("limit", String(total));
      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Export failed"));
      const rows = Array.isArray((data as any)?.projects) ? ((data as any).projects as Project[]) : [];

      const now = new Date();
      const stamp = now.toISOString().slice(0, 10);

      if (format === "json") {
        const payload = rows.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          startDate: p.startDate ?? null,
          endDate: p.endDate ?? null,
          createdAt: p.createdAt,
          completionRate: p.completionRate,
          tasksCompleted: p.tasksCompleted,
          tasksTotal: p.tasksTotal,
          creatorEmail: p.creator?.email ?? null,
          membersCount: Array.isArray(p.members) ? p.members.length : 0,
        }));
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `projects_${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Export JSON pronto");
        return;
      }

      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const header = [
        "id",
        "name",
        "status",
        "startDate",
        "endDate",
        "createdAt",
        "completionRate",
        "tasksCompleted",
        "tasksTotal",
        "creatorEmail",
        "membersCount",
      ].join(",");
      const lines = rows.map((p) =>
        [
          esc(p.id),
          esc(p.name),
          esc(p.status),
          esc(p.startDate ?? ""),
          esc(p.endDate ?? ""),
          esc(p.createdAt),
          esc(p.completionRate),
          esc(p.tasksCompleted),
          esc(p.tasksTotal),
          esc(p.creator?.email ?? ""),
          esc(Array.isArray(p.members) ? p.members.length : 0),
        ].join(",")
      );
      const csv = [header, ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projects_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export CSV pronto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    { key: "name", label: "Nome", sortable: true },
    { key: "status", label: "Stato", sortable: true },
    { key: "owner", label: "Owner", sortable: false },
    { key: "start", label: "Start date", sortable: false },
    { key: "end", label: "End date", sortable: false },
    { key: "completionRate", label: "Completamento", sortable: true },
    { key: "description", label: "Descrizione", sortable: false },
    { key: "users", label: "Utenti", sortable: false },
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
    <TooltipProvider>
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
              <h1 className="text-3xl font-bold text-foreground">Projects</h1>
              <p className="text-muted-foreground mt-1">Gestisci i progetti e lo stato di avanzamento.</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isExporting || (pagination?.total ?? projects.length) === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? "Export…" : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void exportProjects("csv")} disabled={isExporting}>
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportProjects("json")} disabled={isExporting}>
                    Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => toast("Exporta i risultati attualmente filtrati/ordinati.")}
                    disabled
                  >
                    Usa i filtri per ridurre i dati
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-primary hover:bg-primary/90 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Add Project
              </Button>
            </div>
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
                {/* Mobile cards */}
                <div className="sm:hidden divide-y">
                  <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={isAllSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                    <div className="text-sm text-muted-foreground">Seleziona tutti</div>
                  </div>

                  {projects.map((project) => {
                    const perms = getProjectPermissions(project);
                    const editTooltip = perms.canEdit ? "Modifica progetto" : getPermissionTooltip("edit");
                    const archiveTooltip =
                      project.status === "archived"
                        ? "Progetto già archiviato."
                        : perms.canArchive
                          ? "Archivia progetto"
                          : getPermissionTooltip("archive");
                    const deleteTooltip = perms.canDelete ? "Elimina progetto" : getPermissionTooltip("delete");

                    return (
                      <div key={project.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="checkbox"
                              className="mt-1 rounded border-gray-300"
                              checked={selectedProjects.has(project.id)}
                              onChange={(e) => toggleSelect(project.id, e.target.checked)}
                            />
                            <div className="min-w-0">
                              <Link href={`/project/${project.id}`} className="hover:underline">
                                <div className="text-sm font-medium text-foreground truncate">{project.name}</div>
                              </Link>
                              <div className="text-xs text-muted-foreground">Creato: {formatDate(project.createdAt)}</div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(project.status)}
                            <div className="flex items-center gap-1">
                              <ActionIconButton
                                tooltip={editTooltip}
                                disabled={!perms.canEdit}
                                onClick={() => openEditProject(project)}
                              >
                                <Pencil className="h-4 w-4" />
                              </ActionIconButton>
                              <ActionIconButton
                                tooltip={archiveTooltip}
                                disabled={!perms.canArchive || project.status === "archived"}
                                onClick={() => void archiveSingleProject(project)}
                              >
                                <Archive className="h-4 w-4" />
                              </ActionIconButton>
                              <ActionIconButton
                                tooltip={deleteTooltip}
                                disabled={!perms.canDelete}
                                onClick={() => void deleteSingleProject(project)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </ActionIconButton>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Owner</div>
                            <div className="text-foreground truncate">
                              {project.creator?.name ||
                                `${project.creator?.firstName || ""} ${project.creator?.lastName || ""}`.trim() ||
                                project.creator?.email ||
                                "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Start</div>
                            <div className="text-foreground">{formatDate(project.startDate)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">End</div>
                            <div className="text-foreground">{formatDate(project.endDate)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Completamento</div>
                            <div className="text-foreground">{project.completionRate}%</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1">
                            <Progress value={project.completionRate} className="h-2" />
                            <div className="text-xs text-muted-foreground mt-1">
                              {project.tasksCompleted}/{project.tasksTotal} tasks
                            </div>
                          </div>
                          <div className="flex items-center -space-x-2">
                            {project.members.slice(0, 4).map((member, idx) => (
                              <Avatar
                                key={member.user.id}
                                className="h-8 w-8 border-2 border-white"
                                style={{ zIndex: project.members.length - idx }}
                              >
                                <AvatarFallback className="bg-accent text-foreground text-xs">
                                  {getInitials(member.user.name, member.user.firstName, member.user.lastName)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {project.members.length > 4 ? (
                              <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600 font-medium">
                                +{project.members.length - 4}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
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
                      {projects.map((project) => {
                        const perms = getProjectPermissions(project);
                        const editTooltip = perms.canEdit ? "Modifica progetto" : getPermissionTooltip("edit");
                        const archiveTooltip =
                          project.status === "archived"
                            ? "Progetto già archiviato."
                            : perms.canArchive
                              ? "Archivia progetto"
                              : getPermissionTooltip("archive");
                        const deleteTooltip = perms.canDelete ? "Elimina progetto" : getPermissionTooltip("delete");

                        return (
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
                                <div className="text-sm font-medium text-foreground">{project.name}</div>
                                <div className="text-xs text-muted-foreground">Created: {formatDate(project.createdAt)}</div>
                              </Link>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap align-top">{getStatusBadge(project.status)}</td>
                            <td className="px-4 py-4 whitespace-nowrap align-top">
                              <div className="text-sm text-foreground">
                                {project.creator?.name ||
                                  `${project.creator?.firstName || ""} ${project.creator?.lastName || ""}`.trim() ||
                                  project.creator?.email ||
                                  "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">{project.creator?.email || "—"}</div>
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
                              <div className="text-sm text-foreground line-clamp-2 max-w-xs">{project.description || "—"}</div>
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
                                      {getInitials(member.user.name, member.user.firstName, member.user.lastName)}
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
                              <div className="flex justify-end gap-1">
                                <ActionIconButton
                                  tooltip={editTooltip}
                                  disabled={!perms.canEdit}
                                  onClick={() => openEditProject(project)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </ActionIconButton>
                                <ActionIconButton
                                  tooltip={archiveTooltip}
                                  disabled={!perms.canArchive || project.status === "archived"}
                                  onClick={() => void archiveSingleProject(project)}
                                >
                                  <Archive className="h-4 w-4" />
                                </ActionIconButton>
                                <ActionIconButton
                                  tooltip={deleteTooltip}
                                  disabled={!perms.canDelete}
                                  onClick={() => void deleteSingleProject(project)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </ActionIconButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
      {/* Edit Project Dialog */}
      <EditProjectDialog
        open={showEditDialog}
        project={editingProject}
        onClose={() => {
          setShowEditDialog(false);
          setEditingProject(null);
        }}
        onSuccess={handleProjectUpdated}
      />
    </div>
    </TooltipProvider>
  );
}
