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
import { ArrowLeft, Loader2, Plus, Trash2, Archive, ChevronLeft, ChevronRight, SortAsc, SortDesc, Pencil, Download, Folder, PlayCircle, CheckCircle2, BarChart, ListTodo, Search, Filter, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { cn } from "@/lib/utils";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildDelimitedText, buildXlsHtml, downloadCsvFile, downloadXlsFile, isoDate } from "@/lib/export";

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

  const stats = useMemo(() => {
    const totalProjects = pagination?.total ?? projects.length;
    // Note: These stats are based on the current page. For global stats, a dedicated API endpoint is needed.
    const running = projects.filter(p => p.status === 'running').length;
    const avgCompletion = projects.length > 0
      ? Math.round(projects.reduce((acc, p) => acc + p.completionRate, 0) / projects.length)
      : 0;
    const finishedTasks = projects.reduce((acc, p) => acc + p.tasksCompleted, 0);

    return { totalProjects, running, avgCompletion, finishedTasks };
  }, [projects, pagination]);

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

      const getEmail = (m: any) => String(m?.user?.email || "").trim();
      const members = (p: Project) => (Array.isArray(p.members) ? p.members : []);
      const owners = (p: Project) => members(p).filter((m) => m?.role === "owner").map(getEmail).filter(Boolean);
      const managers = (p: Project) => members(p).filter((m) => m?.role === "manager").map(getEmail).filter(Boolean);
      const memberEmails = (p: Project) => members(p).filter((m) => m?.role === "member").map(getEmail).filter(Boolean);
      const membersDetailed = (p: Project) =>
        members(p)
          .map((m) => {
            const email = getEmail(m);
            const role = String(m?.role || "").trim();
            if (!email || !role) return "";
            return `${email}:${role}`;
          })
          .filter(Boolean)
          .join(" | ");

      if (format === "json") {
        const payload = rows.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          description: p.description ?? "",
          startDate: p.startDate ?? null,
          endDate: p.endDate ?? null,
          createdAt: p.createdAt,
          completionRate: p.completionRate,
          tasksCompleted: p.tasksCompleted,
          tasksTotal: p.tasksTotal,
          creatorEmail: p.creator?.email ?? null,
          owners: owners(p),
          managers: managers(p),
          members: memberEmails(p),
          membersDetailed: membersDetailed(p),
          membersCount: members(p).length,
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

      const header = [
        "id",
        "name",
        "status",
        "description",
        "startDate",
        "endDate",
        "createdAt",
        "completionRate",
        "tasksCompleted",
        "tasksTotal",
        "creatorEmail",
        "owners",
        "managers",
        "members",
        "membersDetailed",
        "membersCount",
      ];
      const tableRows = rows.map((p) => [
        p.id,
        p.name,
        p.status,
        p.description ?? "",
        isoDate(p.startDate ?? ""),
        isoDate(p.endDate ?? ""),
        isoDate(p.createdAt),
        p.completionRate,
        p.tasksCompleted,
        p.tasksTotal,
        p.creator?.email ?? "",
        owners(p).join(" | "),
        managers(p).join(" | "),
        memberEmails(p).join(" | "),
        membersDetailed(p),
        members(p).length,
      ]);

      if (format === "csv") {
        const csv = buildDelimitedText({ header, rows: tableRows });
        downloadCsvFile(`projects_${stamp}.csv`, csv);
        toast.success("Export CSV pronto");
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const exportProjectsXls = async () => {
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

      const getEmail = (m: any) => String(m?.user?.email || "").trim();
      const members = (p: Project) => (Array.isArray(p.members) ? p.members : []);
      const owners = (p: Project) => members(p).filter((m) => m?.role === "owner").map(getEmail).filter(Boolean);
      const managers = (p: Project) => members(p).filter((m) => m?.role === "manager").map(getEmail).filter(Boolean);
      const memberEmails = (p: Project) => members(p).filter((m) => m?.role === "member").map(getEmail).filter(Boolean);
      const membersDetailed = (p: Project) =>
        members(p)
          .map((m) => {
            const email = getEmail(m);
            const role = String(m?.role || "").trim();
            if (!email || !role) return "";
            return `${email}:${role}`;
          })
          .filter(Boolean)
          .join(" | ");

      const header = [
        "id",
        "name",
        "status",
        "description",
        "startDate",
        "endDate",
        "createdAt",
        "completionRate",
        "tasksCompleted",
        "tasksTotal",
        "creatorEmail",
        "owners",
        "managers",
        "members",
        "membersDetailed",
        "membersCount",
      ];
      const tableRows = rows.map((p) => [
        p.id,
        p.name,
        p.status,
        p.description ?? "",
        isoDate(p.startDate ?? ""),
        isoDate(p.endDate ?? ""),
        isoDate(p.createdAt),
        p.completionRate,
        p.tasksCompleted,
        p.tasksTotal,
        p.creator?.email ?? "",
        owners(p).join(" | "),
        managers(p).join(" | "),
        memberEmails(p).join(" | "),
        membersDetailed(p),
        members(p).length,
      ]);

      const html = buildXlsHtml({ header, rows: tableRows, sheetName: "Projects" });
      downloadXlsFile(`projects_${stamp}.xls`, html);
      toast.success("Export XLS pronto");
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
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen min-h-[100dvh] bg-background text-foreground">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
              <p className="text-muted-foreground mt-1">Manage your projects and their real-time progress efficiently.</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isExporting || (pagination?.total ?? projects.length) === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? "Export..." : "Export CSV"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void exportProjects("csv")} disabled={isExporting}>Export CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportProjectsXls()} disabled={isExporting}>Export XLS</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportProjects("json")} disabled={isExporting}>Export JSON</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Folder className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Projects</span>
                </div>
                <div className="text-3xl font-bold">{stats.totalProjects}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <PlayCircle className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Running Now</span>
                </div>
                <div className="text-3xl font-bold text-purple-500">{stats.running}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg. Completion</span>
                </div>
                <div className="text-3xl font-bold text-orange-500">{stats.avgCompletion}%</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Finished Tasks</span>
                </div>
                <div className="text-3xl font-bold text-green-500">{stats.finishedTasks}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-4 p-4 rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm items-start lg:items-center justify-between">
              <div className="relative flex-1 w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  defaultValue={search}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateQuery({ search: (e.target as HTMLInputElement).value });
                    }
                  }}
                  className="pl-9 bg-background/50 border-border/50 h-10 w-full"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <select
                  className="h-10 rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={statusFilter}
                  onChange={(e) => updateQuery({ status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => updateQuery({ startDate: e.target.value })}
                    className="bg-background/50 border-border/50 h-10 w-auto"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => updateQuery({ endDate: e.target.value })}
                    className="bg-background/50 border-border/50 h-10 w-auto"
                  />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="destructive"
                    size="icon"
                    disabled={selectedProjects.size === 0 || isBulkLoading}
                    onClick={() => bulkAction("delete")}
                    className="h-10 w-10"
                    title="Delete Selected"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={selectedProjects.size === 0 || isBulkLoading}
                    onClick={() => bulkAction("archive")}
                    className="h-10 w-10 border-border/50"
                    title="Archive Selected"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Projects Table */}
            <Card className="border-border/50 bg-card/50 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {error && (
                  <div className="p-4 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">{error}</div>
                )}
                {projects.length === 0 && !error ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Folder className="h-12 w-12 mb-4 opacity-20" />
                    <p className="mb-4">No projects found</p>
                    <Button onClick={() => setShowCreateDialog(true)} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Project
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="w-full overflow-auto">
                      <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b bg-muted/30">
                          <tr className="border-b border-border/50 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[50px]">
                              <input
                                type="checkbox"
                                className="rounded border-border/50 bg-background"
                                checked={isAllSelected}
                                onChange={(e) => toggleSelectAll(e.target.checked)}
                              />
                            </th>
                            {columns.map((col) => (
                              <th
                                key={col.key}
                                className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs"
                              >
                                <button
                                  type="button"
                                  className={cn(
                                    "flex items-center gap-1 hover:text-foreground transition-colors",
                                    !col.sortable && "cursor-default"
                                  )}
                                  onClick={col.sortable ? () => handleSort(col.key as OrderBy) : undefined}
                                  disabled={!col.sortable}
                                >
                                  {col.label}
                                  {col.sortable && sortIcon(col.key as OrderBy)}
                                </button>
                              </th>
                            ))}
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
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
                              <tr key={project.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                                <td className="p-4 align-middle">
                                  <input
                                    type="checkbox"
                                    className="rounded border-border/50 bg-background"
                                    checked={selectedProjects.has(project.id)}
                                    onChange={(e) => toggleSelect(project.id, e.target.checked)}
                                  />
                                </td>
                                <td className="p-4 align-middle">
                                  <Link href={`/project/${project.id}`} className="block hover:underline group">
                                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{project.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Created: {formatDate(project.createdAt)}</div>
                                  </Link>
                                </td>
                                <td className="p-4 align-middle">{getStatusBadge(project.status)}</td>
                                <td className="p-4 align-middle">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-foreground">
                                      {project.creator?.name ||
                                        `${project.creator?.firstName || ""} ${project.creator?.lastName || ""}`.trim() ||
                                        project.creator?.email ||
                                        "—"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{project.creator?.email || "—"}</span>
                                  </div>
                                </td>
                                <td className="p-4 align-middle text-muted-foreground">{formatDate(project.startDate)}</td>
                                <td className="p-4 align-middle text-muted-foreground">{formatDate(project.endDate)}</td>
                                <td className="p-4 align-middle min-w-[180px]">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                                        style={{ width: `${project.completionRate}%` }} 
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-foreground w-[3ch] text-right">{project.completionRate}%</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    {project.tasksCompleted}/{project.tasksTotal} tasks
                                  </div>
                                </td>
                                <td className="p-4 align-middle max-w-xs">
                                  <div className="text-sm text-muted-foreground truncate" title={project.description || ""}>
                                    {project.description || "—"}
                                  </div>
                                </td>
                                <td className="p-4 align-middle">
                                  <div className="flex items-center -space-x-2">
                                    {project.members.slice(0, 4).map((member, idx) => (
                                      <Avatar
                                        key={member.user.id}
                                        className="h-8 w-8 border-2 border-background ring-1 ring-border/10"
                                        style={{ zIndex: project.members.length - idx }}
                                      >
                                        <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">
                                          {getInitials(member.user.name, member.user.firstName, member.user.lastName)}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))}
                                    {project.members.length > 4 && (
                                      <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground font-medium ring-1 ring-border/10">
                                        +{project.members.length - 4}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 align-middle text-right">
                                  <div className="flex justify-end gap-1 opacity-60 hover:opacity-100 transition-opacity">
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
                                      className="text-destructive hover:bg-destructive/10"
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
                      <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2 bg-muted/10">
                        <div className="text-xs text-muted-foreground mr-4">
                          Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, pagination.total)} of {pagination.total} projects
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(page - 1)}
                          disabled={!pagination.hasPrev}
                          className="h-8 border-border/50"
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                            // Simplified pagination logic for UI cleanup
                            const pageNum = i + 1; 
                            return (
                              <Button
                                key={pageNum}
                                variant={page === pageNum ? "default" : "ghost"}
                                size="sm"
                                onClick={() => handlePageChange(pageNum)}
                                className={cn("h-8 w-8 p-0", page === pageNum && "bg-orange-600 hover:bg-orange-700 text-white")}
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
                          className="h-8 border-border/50"
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
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