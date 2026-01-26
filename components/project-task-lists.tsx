"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Search, Download, Upload, List } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateTaskGlobalDialog } from "@/components/create-task-global-dialog";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { CSVImportWizard } from "@/components/custom-fields/CSVImportWizard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatEurCents } from "@/lib/money";
import { buildDelimitedText, buildXlsHtml, downloadCsvFile, downloadXlsFile, isoDate, safeFileStem } from "@/lib/export";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type ListDto = { id: string; name: string; updatedAt: string; position?: number; _count?: { tasks: number } };

type TaskDto = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  listId: string | null;
  position?: number;
  taskList: { id: string; name: string } | null;
  legacyTags?: string | null;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  amountCents?: number | null;
};

const DEFAULT_LIST_NAME = "Untitled list";

function statusBadge(status: string): { label: string; variant: "secondary" | "outline" | "default" } {
  switch (status) {
    case "todo":
      return { label: "To do", variant: "outline" };
    case "in_progress":
      return { label: "In progress", variant: "secondary" };
    case "done":
      return { label: "Done", variant: "default" };
    default:
      return { label: status, variant: "outline" };
  }
}

function parseLegacyTags(legacyTags: string | null | undefined): string[] {
  if (!legacyTags) return [];
  try {
    const parsed = JSON.parse(String(legacyTags));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

type DisplayTag = { name: string; color?: string | null };

function getDisplayTags(t: TaskDto): DisplayTag[] {
  const rel = Array.isArray(t.tags)
    ? t.tags
        .map((x) => ({
          name: String(x?.name || "").trim(),
          color: x?.color ? String(x.color) : null,
        }))
        .filter((x) => x.name)
    : [];
  if (rel.length > 0) return rel;
  return parseLegacyTags(t.legacyTags).map((name) => ({ name: String(name || "").trim(), color: null })).filter((x) => x.name);
}

type TagTotals = {
  daFatturare: number;
  fatturato: number;
  incassato: number;
  previsionale: number;
  totale: number;
};

function calculateTagTotals(tasks: TaskDto[]): TagTotals {
  const totals: TagTotals = { daFatturare: 0, fatturato: 0, incassato: 0, previsionale: 0, totale: 0 };

  for (const t of tasks) {
    const amount = typeof t.amountCents === "number" ? t.amountCents : 0;
    if (amount === 0) continue;

    totals.totale += amount;
    const tags = getDisplayTags(t).map((x) => x.name.toUpperCase());

    if (tags.includes("DA FATTURARE") || tags.includes("DA INSERIRE")) {
      totals.daFatturare += amount;
    } else if (tags.includes("FATTURATO") || tags.includes("PRATICA INSERITA")) {
      totals.fatturato += amount;
    } else if (tags.includes("INCASSATO")) {
      totals.incassato += amount;
    } else {
      totals.previsionale += amount; // default: previsionale
    }
  }
  return totals;
}

function getTagBadgeClass(tagName: string): string {
  const n = String(tagName || "").trim().toUpperCase();
  if (n === "PAGATO") return "bg-emerald-500 text-white border-emerald-600/20";
  if (n === "STAND BY") return "bg-orange-500 text-white border-orange-600/20";
  if (n === "FATTURA EMESSA") return "bg-sky-500 text-white border-sky-600/20";
  return "bg-primary text-primary-foreground border-primary/20";
}

function SortableTask({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "Task" },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : "auto",
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start group/task">
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="mt-4 cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-muted-foreground opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SortableList({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "List" },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/list relative">
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-1 top-4 z-10 cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-muted-foreground opacity-0 group-hover/list:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div className={!disabled ? "pl-6" : ""}>{children}</div>
    </div>
  );
}

export function ProjectTaskLists(props: {
  projectId: string;
  sessionUserId?: string | null;
  sessionGlobalRole?: string | null;
  projectMembers?: any[];
}) {
  const { projectId, sessionUserId, sessionGlobalRole, projectMembers } = props;
  const meId = sessionUserId ? String(sessionUserId) : null;
  const globalRole = String(sessionGlobalRole || "member");
  const myMembership = meId && Array.isArray(projectMembers)
    ? projectMembers.find((m: any) => m?.userId === meId) || null
    : null;
  const isProjectMember = Boolean(myMembership);
  const myProjectRole = myMembership?.role ? String(myMembership.role) : "";
  const isProjectManager = myProjectRole === "owner" || myProjectRole === "manager";
  const canManageTasks = globalRole === "admin" || isProjectManager || (globalRole === "manager" && isProjectMember);
  const noPermissionHint = "Solo admin o project owner/manager possono modificare o eliminare le task.";

  const [lists, setLists] = useState<ListDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);

  // DnD State
  const [localLists, setLocalLists] = useState<ListDto[]>([]);
  const [localTasks, setLocalTasks] = useState<TaskDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Load local storage order if available
    const savedOrder = localStorage.getItem(`project_order_${projectId}`);
    if (savedOrder) {
      try {
        const { listOrder, taskOrder } = JSON.parse(savedOrder);
        const sortedLists = [...lists].sort((a, b) => {
          const posA = listOrder[a.id] ?? a.position ?? 0;
          const posB = listOrder[b.id] ?? b.position ?? 0;
          return posA - posB;
        });
        const sortedTasks = [...tasks].sort((a, b) => {
          const posA = taskOrder[a.id] ?? a.position ?? 0;
          const posB = taskOrder[b.id] ?? b.position ?? 0;
          return posA - posB;
        });
        setLocalLists(sortedLists);
        setLocalTasks(sortedTasks);
      } catch {
        setLocalLists(lists);
        setLocalTasks(tasks);
      }
    } else {
      setLocalLists(lists);
      setLocalTasks(tasks);
    }
  }, [lists, tasks, projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Only handle Task moving between lists here
    const activeTask = localTasks.find((t) => t.id === activeId);
    if (!activeTask) return; // Not a task

    const overTask = localTasks.find((t) => t.id === overId);
    const overList = localLists.find((l) => l.id === overId);

    if (overTask && activeTask.listId !== overTask.listId) {
      setLocalTasks((items) => {
        const activeIndex = items.findIndex((t) => t.id === activeId);
        const overIndex = items.findIndex((t) => t.id === overId);
        if (items[activeIndex].listId !== items[overIndex].listId) {
          items[activeIndex].listId = items[overIndex].listId;
          return arrayMove(items, activeIndex, overIndex);
        }
        return items;
      });
    } else if (overList && activeTask.listId !== overList.id) {
      setLocalTasks((items) => {
        const activeIndex = items.findIndex((t) => t.id === activeId);
        items[activeIndex].listId = overList.id;
        return [...items];
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const isList = localLists.some(l => l.id === activeId);

    if (isList) {
      setLocalLists((items) => {
        const oldIndex = items.findIndex((l) => l.id === activeId);
        const newIndex = items.findIndex((l) => l.id === overId);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Persist to LocalStorage
        const listOrder = newItems.reduce((acc, item, index) => ({ ...acc, [item.id]: index }), {});
        const currentStore = JSON.parse(localStorage.getItem(`project_order_${projectId}`) || '{"listOrder":{},"taskOrder":{}}');
        localStorage.setItem(`project_order_${projectId}`, JSON.stringify({ ...currentStore, listOrder }));

        return newItems;
      });
    } else {
      setLocalTasks((items) => {
        const oldIndex = items.findIndex((t) => t.id === activeId);
        const newIndex = items.findIndex((t) => t.id === overId);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Persist to LocalStorage
        const taskOrder = newItems.reduce((acc, item, index) => ({ ...acc, [item.id]: index }), {});
        const currentStore = JSON.parse(localStorage.getItem(`project_order_${projectId}`) || '{"listOrder":{},"taskOrder":{}}');
        localStorage.setItem(`project_order_${projectId}`, JSON.stringify({ ...currentStore, taskOrder }));

        return newItems;
      });
    }
  };

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [listsUnavailable, setListsUnavailable] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const deferredQ = useDeferredValue(q);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);

  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [savingList, setSavingList] = useState(false);

  const [renameListId, setRenameListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [savingTaskTitle, setSavingTaskTitle] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [defaultListIdForNewTask, setDefaultListIdForNewTask] = useState<string | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [listsRes, tasksRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/lists`, { cache: "no-store" }),
        fetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}&page=1&pageSize=200&view=projectLists`, { cache: "no-store" }),
      ]);

      const listsData = await listsRes.json().catch(() => ({}));
      const tasksData = await tasksRes.json().catch(() => ({}));

      if (listsRes.status === 501) {
        setListsUnavailable(listsData?.error || "Liste non disponibili (migrations non applicate).");
        setLists([]);
      } else if (!listsRes.ok) {
        throw new Error(listsData?.error || "Errore caricamento liste");
      } else {
        const l = Array.isArray(listsData?.lists) ? (listsData.lists as ListDto[]) : [];
        setLists(l);
        setListsUnavailable(null);
        if (expanded.length === 0 && l.length > 0) setExpanded([l[0].id]);
      }

      const t = Array.isArray(tasksData?.tasks) ? (tasksData.tasks as TaskDto[]) : [];
      setTasks(t);
      setTasksPage(1);
      setTasksTotal(Number.isFinite(tasksData?.total) ? Number(tasksData.total) : t.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTasks = async () => {
    if (loadingMore) return;
    if (tasks.length >= tasksTotal) return;
    const nextPage = tasksPage + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/tasks?projectId=${encodeURIComponent(projectId)}&page=${nextPage}&pageSize=200&view=projectLists`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore caricamento task");
      const next = Array.isArray(data?.tasks) ? (data.tasks as TaskDto[]) : [];
      setTasks((prev) => [...prev, ...next]);
      setTasksPage(nextPage);
      setTasksTotal(Number.isFinite(data?.total) ? Number(data.total) : tasksTotal);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento task");
    } finally {
      setLoadingMore(false);
    }
  };

  const exportTasks = async (format: "csv" | "xls") => {
    const MAX_EXPORT = 5000;
    setIsExporting(true);
    try {
      const query = q.trim();
      const base = new URLSearchParams();
      base.set("projectId", projectId);
      if (query) base.set("q", query);

      // Fetch total first (pageSize is capped server-side to 200)
      const firstRes = await fetch(`/api/tasks?${base.toString()}&page=1&pageSize=1`, { cache: "no-store" });
      const firstData = await firstRes.json().catch(() => ({}));
      if (!firstRes.ok) throw new Error(firstData?.error || "Export fallito");
      const total = Number.isFinite(firstData?.total) ? Number(firstData.total) : 0;
      if (!total) {
        toast("Nessuna task da esportare");
        return;
      }
      if (total > MAX_EXPORT) {
        toast.error(`Troppe task da esportare (${total}). Usa la ricerca per ridurre i risultati.`);
        return;
      }

      const pageSize = 200;
      const pages = Math.ceil(total / pageSize);
      const all: any[] = [];
      for (let page = 1; page <= pages; page++) {
        const params = new URLSearchParams(base.toString());
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        const res = await fetch(`/api/tasks?${params.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Export fallito");
        const chunk = Array.isArray(data?.tasks) ? data.tasks : [];
        all.push(...chunk);
      }

      const header = [
        "projectId",
        "projectName",
        "category",
        "taskId",
        "title",
        "description",
        "status",
        "priority",
        "dueDate",
        "amountEur",
        "tags",
        "assignees",
        "commentsCount",
        "attachmentsCount",
        "subtasksTotal",
        "subtasksDone",
        "createdAt",
        "updatedAt",
      ];

      const rows = all.map((t: any) => {
        const category = String(t?.taskList?.name || DEFAULT_LIST_NAME);
        const tags = Array.isArray(t?.tags) ? t.tags.map((x: any) => String(x?.name || "").trim()).filter(Boolean) : [];
        const legacy = parseLegacyTags(t?.legacyTags);
        const displayTags = tags.length > 0 ? tags : legacy;
        const assignees = Array.isArray(t?.assignees)
          ? t.assignees
            .map((a: any) => String(a?.user?.email || "").trim())
            .filter(Boolean)
          : [];

        const subtasksTotal = Number.isFinite(t?._count?.subtasks) ? Number(t._count.subtasks) : 0;
        const subtasksDone = Array.isArray(t?.subtasks) ? t.subtasks.length : 0;

        // Export as pure number (euros with decimals) for Excel compatibility
        const amountEur = typeof t?.amountCents === "number" ? (t.amountCents / 100) : "";

        return [
          String(t?.project?.id || projectId),
          String(t?.project?.name || ""),
          category,
          String(t?.id || ""),
          String(t?.title || ""),
          String(t?.description || ""),
          String(t?.status || ""),
          String(t?.priority || ""),
          isoDate(t?.dueDate),
          amountEur,
          displayTags.join(" | "),
          assignees.join(" | "),
          Number.isFinite(t?._count?.comments) ? Number(t._count.comments) : 0,
          Number.isFinite(t?._count?.attachments) ? Number(t._count.attachments) : 0,
          subtasksTotal,
          subtasksDone,
          isoDate(t?.createdAt),
          isoDate(t?.updatedAt),
        ];
      });

      const stamp = new Date().toISOString().slice(0, 10);
      const projLabel = safeFileStem(String((all[0] as any)?.project?.name || projectId));

      if (format === "csv") {
        const csv = buildDelimitedText({ header, rows });
        downloadCsvFile(`tasks_${projLabel}_${stamp}.csv`, csv);
        toast.success("Export CSV pronto");
        return;
      }

      const html = buildXlsHtml({ header, rows, sheetName: "Tasks" });
      downloadXlsFile(`tasks_${projLabel}_${stamp}.xls`, html);
      toast.success("Export XLS pronto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export fallito");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const tasksByListId = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const t of localTasks) {
      // Filter by query if present
      if (deferredQ.trim()) {
        const query = deferredQ.trim().toLowerCase();
        const hay = `${t.title} ${t.description || ""}`.toLowerCase();
        if (!hay.includes(query)) continue;
      }

      const key = t.listId || "__none__";
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [localTasks, deferredQ]);

  // Calcola totali globali per il progetto
  const globalTotals = useMemo(() => {
    return calculateTagTotals(localTasks);
  }, [localTasks]);

  const createList = async () => {
    const name = newListName.trim();
    if (!name) return;
    setSavingList(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile creare categoria");
      toast.success("Categoria creata");
      setNewListName("");
      setShowCreateList(false);
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile creare categoria");
    } finally {
      setSavingList(false);
    }
  };

  const renameList = async () => {
    if (!renameListId) return;
    const name = renameValue.trim();
    if (!name) return;
    setSavingList(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/lists/${renameListId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile rinominare categoria");
      toast.success("Categoria rinominata");
      setRenameListId(null);
      setRenameValue("");
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile rinominare categoria");
    } finally {
      setSavingList(false);
    }
  };

  const deleteList = async (listId: string, name: string) => {
    if (!confirm(`Eliminare la categoria “${name}”? Le task verranno spostate in “${DEFAULT_LIST_NAME}”.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/lists/${listId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile eliminare categoria");
      toast.success("Categoria eliminata");
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile eliminare categoria");
    }
  };

  const startEditTaskTitle = (t: TaskDto) => {
    if (!canManageTasks) {
      toast.error(noPermissionHint);
      return;
    }
    setEditingTaskId(t.id);
    setEditingTaskTitle(t.title || "");
  };

  const cancelEditTaskTitle = () => {
    setEditingTaskId(null);
    setEditingTaskTitle("");
  };

  const saveEditedTaskTitle = async () => {
    if (!editingTaskId) return;
    if (!canManageTasks) {
      toast.error(noPermissionHint);
      return;
    }
    const title = editingTaskTitle.trim();
    if (!title) return;
    setSavingTaskTitle(true);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(editingTaskId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile aggiornare titolo");
      setTasks((prev) => prev.map((t) => (t.id === editingTaskId ? { ...t, title } : t)));
      toast.success("Titolo aggiornato");
      cancelEditTaskTitle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile aggiornare titolo");
    } finally {
      setSavingTaskTitle(false);
    }
  };

  const deleteTask = async (t: TaskDto) => {
    if (!canManageTasks) {
      toast.error(noPermissionHint);
      return;
    }
    if (!confirm(`Eliminare la task “${t.title}”?`)) return;
    setDeletingTaskId(t.id);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile eliminare task");

      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      setTasksTotal((prev) => Math.max(0, prev - 1));
      if (t.listId) {
        setLists((prev) =>
          prev.map((l) =>
            l.id === t.listId
              ? { ...l, _count: l._count ? { tasks: Math.max(0, (l._count.tasks || 0) - 1) } : l._count }
              : l
          )
        );
      }
      if (selectedTaskId === t.id) setSelectedTaskId(null);
      toast.success("Task eliminata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile eliminare task");
    } finally {
      setDeletingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  if (listsUnavailable) {
    return (
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="font-semibold mb-1">Categorie non disponibili</div>
          <div className="text-sm text-muted-foreground">{listsUnavailable}</div>
          <div className="text-sm text-muted-foreground mt-3">
            Applica la migration Prisma e poi esegui il backfill (`scripts/backfill-task-lists.ts`).
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca task…" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Export…" : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void exportTasks("csv")} disabled={isExporting}>
                Export CSV (task)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportTasks("xls")} disabled={isExporting}>
                Export XLS (task)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setShowImportWizard(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={() => setShowCreateList(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuova categoria
          </Button>
        </div>
      </div>

      <CSVImportWizard
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        projectId={projectId}
        onSuccess={fetchAll}
      />

      {/* Totali globali progetto */}
      {globalTotals.totale > 0 && (
        <Card className="mb-4">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {globalTotals.daFatturare > 0 && (
                <div>
                  <span className="text-muted-foreground">Da fatturare:</span>{" "}
                  <strong className="text-orange-600">{formatEurCents(globalTotals.daFatturare)}</strong>
                </div>
              )}
              {globalTotals.fatturato > 0 && (
                <div>
                  <span className="text-muted-foreground">Fatturato:</span>{" "}
                  <strong className="text-blue-600">{formatEurCents(globalTotals.fatturato)}</strong>
                </div>
              )}
              {globalTotals.incassato > 0 && (
                <div>
                  <span className="text-muted-foreground">Incassato:</span>{" "}
                  <strong className="text-green-600">{formatEurCents(globalTotals.incassato)}</strong>
                </div>
              )}
              {globalTotals.previsionale > 0 && (
                <div>
                  <span className="text-muted-foreground">Previsionale:</span>{" "}
                  <strong className="text-gray-500">{formatEurCents(globalTotals.previsionale)}</strong>
                </div>
              )}
              <div className="border-l pl-4 ml-auto">
                <span className="text-muted-foreground">TOTALE:</span>{" "}
                <strong>{formatEurCents(globalTotals.totale)}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localLists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <Accordion type="multiple" value={expanded} onValueChange={(v) => setExpanded(v)}>
            {localLists.map((l) => {
              const listTasks = tasksByListId.get(l.id) || [];
              const isOpen = expandedSet.has(l.id);
              return (
                <SortableList key={l.id} id={l.id} disabled={!!q}>
                  <AccordionItem value={l.id} className="border rounded-lg mb-3 bg-white">
                    <AccordionTrigger className="px-4">
                      <div className="flex flex-col w-full pr-4 gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="font-semibold truncate">{l.name}</div>
                            <Badge variant="secondary">
                              {listTasks.length}/{l._count?.tasks ?? listTasks.length}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDefaultListIdForNewTask(l.id);
                                setShowCreateTask(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add task
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setRenameListId(l.id);
                                setRenameValue(l.name);
                              }}
                              title="Rinomina"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteList(l.id, l.name);
                              }}
                              title="Elimina"
                              disabled={l.name === DEFAULT_LIST_NAME}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {/* Totali per tag */}
                        {(() => {
                          const totals = calculateTagTotals(listTasks);
                          if (totals.totale === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {totals.daFatturare > 0 && (
                                <span className="text-orange-600">Da fatturare: {formatEurCents(totals.daFatturare)}</span>
                              )}
                              {totals.fatturato > 0 && (
                                <span className="text-blue-600">Fatturato: {formatEurCents(totals.fatturato)}</span>
                              )}
                              {totals.incassato > 0 && (
                                <span className="text-green-600">Incassato: {formatEurCents(totals.incassato)}</span>
                              )}
                              {totals.previsionale > 0 && (
                                <span className="text-gray-500">Previsionale: {formatEurCents(totals.previsionale)}</span>
                              )}
                              <span className="font-medium text-foreground">Totale: {formatEurCents(totals.totale)}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4">
                      {!isOpen ? null : listTasks.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-3">Nessuna task in questa categoria.</div>
                      ) : (
                        <SortableContext items={listTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2 min-h-[10px]">
                            {listTasks.map((t) => {
                              const sb = statusBadge(t.status);
                              const tags = getDisplayTags(t);
                              const primaryTag = tags[0] || null;
                              const extraTagCount = tags.length > 1 ? tags.length - 1 : 0;
                              const amountEur = typeof t?.amountCents === "number" ? formatEurCents(t.amountCents) : null;
                              const isEditing = editingTaskId === t.id;
                              const isDeleting = deletingTaskId === t.id;
                              const disableRowOpen = isEditing;
                              return (
                                <SortableTask key={t.id} id={t.id} disabled={!!q}>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    className="w-full text-left border rounded-lg p-3 hover:bg-muted/30 transition-colors group"
                                    onClick={() => {
                                      if (disableRowOpen) return;
                                      setSelectedTaskId(t.id);
                                    }}
                                    onKeyDown={(e) => {
                                      if (disableRowOpen) return;
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setSelectedTaskId(t.id);
                                      }
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                          <div className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Input
                                              value={editingTaskTitle}
                                              onChange={(e) => setEditingTaskTitle(e.target.value)}
                                              disabled={!canManageTasks || savingTaskTitle}
                                              onKeyDown={(e) => {
                                                if (e.key === "Escape") {
                                                  e.preventDefault();
                                                  cancelEditTaskTitle();
                                                }
                                                if (e.key === "Enter") {
                                                  e.preventDefault();
                                                  void saveEditedTaskTitle();
                                                }
                                              }}
                                            />
                                            <Button
                                              size="sm"
                                              onClick={() => void saveEditedTaskTitle()}
                                              disabled={!canManageTasks || savingTaskTitle || !editingTaskTitle.trim()}
                                            >
                                              {savingTaskTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={cancelEditTaskTitle}
                                              disabled={savingTaskTitle}
                                            >
                                              Annulla
                                            </Button>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="font-medium truncate">{t.title}</div>
                                            {t.description ? (
                                              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</div>
                                            ) : null}
                                          </>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        {amountEur ? (
                                          <Badge
                                            variant="outline"
                                            className="rounded-md px-4 py-1 text-[11px] font-semibold min-w-[120px] justify-center"
                                            title="Importo"
                                          >
                                            {amountEur}
                                          </Badge>
                                        ) : null}
                                        {primaryTag ? (
                                          <Badge
                                            variant="default"
                                            className={`rounded-md px-4 py-1 text-[11px] font-semibold uppercase tracking-wide min-w-[140px] justify-center transition-opacity ${
                                              primaryTag.color
                                                ? "text-white border border-black/10 hover:opacity-90"
                                                : getTagBadgeClass(primaryTag.name)
                                            }`}
                                            style={primaryTag.color ? { backgroundColor: primaryTag.color } : undefined}
                                            title={tags.map((x) => x.name).join(", ")}
                                          >
                                            {primaryTag.name}
                                          </Badge>
                                        ) : null}
                                        {extraTagCount > 0 ? (
                                          <Badge variant="outline" title={tags.map((x) => x.name).join(", ")}>
                                            +{extraTagCount}
                                          </Badge>
                                        ) : null}
                                        <Badge variant={sb.variant} className="capitalize">
                                          {sb.label}
                                        </Badge>
                                        {t.dueDate ? (
                                          <Badge variant="outline">{new Date(t.dueDate).toLocaleDateString()}</Badge>
                                        ) : null}

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => startEditTaskTitle(t)}
                                            disabled={!canManageTasks || isEditing}
                                            title={canManageTasks ? "Modifica titolo" : noPermissionHint}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => void deleteTask(t)}
                                            disabled={!canManageTasks || isDeleting || isEditing}
                                            title={canManageTasks ? "Elimina task" : noPermissionHint}
                                          >
                                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </SortableTask>
                              );
                            })}
                          </div>
                        </SortableContext>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </SortableList>
              );
            })}
          </Accordion>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="p-4 bg-background border rounded-lg shadow-lg opacity-80">
              {localLists.find(l => l.id === activeId)?.name || localTasks.find(t => t.id === activeId)?.title || "Item"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {tasks.length > 0 && tasks.length < tasksTotal ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMoreTasks} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Carica altre task ({tasksTotal - tasks.length})
          </Button>
        </div>
      ) : null}

      <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Es. Comunicazione" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateList(false)} disabled={savingList}>
              Annulla
            </Button>
            <Button onClick={createList} disabled={savingList || !newListName.trim()}>
              {savingList ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameListId} onOpenChange={(v) => !v && setRenameListId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rinomina categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameListId(null)} disabled={savingList}>
              Annulla
            </Button>
            <Button onClick={renameList} disabled={savingList || !renameValue.trim()}>
              {savingList ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateTaskGlobalDialog
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onSuccess={async () => {
          setShowCreateTask(false);
          setDefaultListIdForNewTask(undefined);
          await fetchAll();
        }}
        defaultProjectId={projectId}
        defaultListId={defaultListIdForNewTask}
      />

      {selectedTaskId ? (
        <TaskDetailModal
          open={true}
          onClose={() => setSelectedTaskId(null)}
          taskId={selectedTaskId}
          projectId={projectId}
          onUpdate={fetchAll}
        />
      ) : null}
    </div>
  );
}


