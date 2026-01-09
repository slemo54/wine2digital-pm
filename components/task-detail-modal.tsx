"use client";

import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SideDrawer } from "@/components/side-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CheckCircle2, 
  Circle, 
  Calendar,
  Tag,
  List,
  Paperclip,
  MessageSquare,
  Plus,
  X,
  Upload,
  Users,
  Hash,
  Clock,
  Loader2,
  Pencil,
  Trash2,
  Link2,
  Archive
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";
import dynamic from "next/dynamic";
import type { MentionUser } from "@/components/ui/rich-text-editor";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { SubtaskChecklists } from "@/components/subtask-checklists";
import { getHrefForFilePath, getImageSrcForFilePath } from "@/lib/drive-links";
import { formatEurCents, parseEurToCents } from "@/lib/money";

const RichTextEditor = dynamic(
  () => import("@/components/ui/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="text-sm text-muted-foreground">Caricamento editor…</div>,
  }
);

function isEffectivelyEmptyRichHtmlClient(html: string): boolean {
  const hasImage = /<img\b/i.test(html);
  const text = String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !hasImage && !text;
}

function isProbablyImageFile(fileName: string, mimeType?: string | null): boolean {
  const mt = String(mimeType || "").toLowerCase();
  if (mt.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(String(fileName || ""));
}

interface Subtask {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  dependencies?: Array<{ id: string; subtaskId: string; dependsOnId: string }>;
  dependentOn?: Array<{ id: string; subtaskId: string; dependsOnId: string }>;
  position: number;
}

interface Comment {
  id: string;
  content: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: string;
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
  filePath: string;
  createdAt: string;
}

interface SubtaskAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
  filePath: string;
  createdAt: string;
}

interface SubtaskComment {
  id: string;
  content: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: string;
}

interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  projectId?: string;
  onUpdate?: () => void;
  initialSubtaskId?: string;
}

export function TaskDetailModal({ open, onClose, taskId, projectId, onUpdate, initialSubtaskId }: TaskDetailModalProps) {
  const { data: session } = useSession();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"subtasks" | "attachments" | "comments" | "activity">("subtasks");
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>([]);
  const [tagsPickerOpen, setTagsPickerOpen] = useState(false);
  const [projectTags, setProjectTags] = useState<Array<{ id: string; name: string }>>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renamingTagName, setRenamingTagName] = useState("");
  const [tagMutationBusy, setTagMutationBusy] = useState(false);
  const [amountPickerOpen, setAmountPickerOpen] = useState(false);
  const [draftAmountInput, setDraftAmountInput] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [newCommentHtml, setNewCommentHtml] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentHtml, setEditingCommentHtml] = useState<string>("");
  const [editingMentionedUserIds, setEditingMentionedUserIds] = useState<string[]>([]);
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projectLists, setProjectLists] = useState<Array<{ id: string; name: string }>>([]);
  const [isEditingTaskTitle, setIsEditingTaskTitle] = useState(false);
  const [taskDraftTitle, setTaskDraftTitle] = useState("");
  const [savingTaskTitle, setSavingTaskTitle] = useState(false);
  const [subtaskDetailOpen, setSubtaskDetailOpen] = useState(false);
  const [selectedSubtask, setSelectedSubtask] = useState<Subtask | null>(null);
  const [subtaskAttachments, setSubtaskAttachments] = useState<SubtaskAttachment[]>([]);
  const [subtaskComments, setSubtaskComments] = useState<SubtaskComment[]>([]);
  const [subtaskUploading, setSubtaskUploading] = useState(false);
  const [subtaskDraftDescription, setSubtaskDraftDescription] = useState("");
  const [isEditingSubtaskTitle, setIsEditingSubtaskTitle] = useState(false);
  const [subtaskDraftTitle, setSubtaskDraftTitle] = useState("");
  const [savingSubtaskTitle, setSavingSubtaskTitle] = useState(false);
  const [subtaskNewCommentHtml, setSubtaskNewCommentHtml] = useState("");
  const [subtaskMentionedUserIds, setSubtaskMentionedUserIds] = useState<string[]>([]);
  const [editingSubtaskCommentId, setEditingSubtaskCommentId] = useState<string | null>(null);
  const [editingSubtaskCommentHtml, setEditingSubtaskCommentHtml] = useState<string>("");
  const [editingSubtaskMentionedUserIds, setEditingSubtaskMentionedUserIds] = useState<string[]>([]);
  const [savingSubtaskCommentEdit, setSavingSubtaskCommentEdit] = useState(false);

  const didOpenInitialSubtaskRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails();
    }
  }, [open, taskId]);

  useEffect(() => {
    didOpenInitialSubtaskRef.current = null;
  }, [taskId]);

  useEffect(() => {
    if (!open) return;
    if (!initialSubtaskId) return;
    if (didOpenInitialSubtaskRef.current === initialSubtaskId) return;

    let cancelled = false;
    (async () => {
      const direct = subtasks.find((s) => s.id === initialSubtaskId) || null;
      if (direct) {
        if (!cancelled) {
          setSelectedSubtask(direct);
          setSubtaskDetailOpen(true);
          didOpenInitialSubtaskRef.current = initialSubtaskId;
        }
        return;
      }

      try {
        const res = await fetch(`/api/tasks/${taskId}/subtasks/${initialSubtaskId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.id) return;
        if (!cancelled) {
          setSelectedSubtask(data);
          setSubtaskDetailOpen(true);
          didOpenInitialSubtaskRef.current = initialSubtaskId;
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialSubtaskId, subtasks, taskId]);

  useEffect(() => {
    if (!subtaskDetailOpen || !selectedSubtask) return;
    setSubtaskDraftDescription(selectedSubtask.description || "");
    setSubtaskDraftTitle(selectedSubtask.title || "");
    setIsEditingSubtaskTitle(false);
    setEditingSubtaskCommentId(null);
    setEditingSubtaskCommentHtml("");
    setEditingSubtaskMentionedUserIds([]);
    setSubtaskNewCommentHtml("");
    setSubtaskMentionedUserIds([]);
    void fetchSubtaskDetails(selectedSubtask.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtaskDetailOpen, selectedSubtask?.id]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      const [taskRes, subtasksRes, commentsRes, attachmentsRes, activityRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/subtasks`),
        fetch(`/api/tasks/${taskId}/comments`),
        fetch(`/api/tasks/${taskId}/attachments`),
        fetch(`/api/tasks/${taskId}/activity`),
      ]);

      const [taskData, subtasksData, commentsData, attachmentsData, activityData] = await Promise.all([
        taskRes.json(),
        subtasksRes.json(),
        commentsRes.json(),
        attachmentsRes.json(),
        activityRes.json(),
      ]);

      setTask(taskData);
      setSubtasks(subtasksData);
      setComments(commentsData);
      setAttachments(attachmentsData);
      setActivityEvents(Array.isArray(activityData?.events) ? activityData.events : []);

      // Lists sono per-progetto: quando il modal viene aperto da /tasks (scope globale),
      // il caller potrebbe non conoscere subito il projectId. In quel caso lo deduciamo dal task.
      const taskProjectId =
        typeof (taskData as any)?.projectId === "string" ? String((taskData as any).projectId) : "";
      const effectiveProjectId = taskProjectId || (projectId && projectId !== "_global" ? projectId : "");
      if (!effectiveProjectId) {
        setProjectLists([]);
        setProjectTags([]);
      } else {
        try {
          const [listsRes, tagsRes] = await Promise.all([
            fetch(`/api/projects/${effectiveProjectId}/lists`, { cache: "no-store" }),
            fetch(`/api/projects/${effectiveProjectId}/tags`, { cache: "no-store" }),
          ]);

          const [listsData, tagsData] = await Promise.all([
            listsRes.json().catch(() => ({})),
            tagsRes.json().catch(() => ({})),
          ]);

          if (listsRes.ok && Array.isArray((listsData as any)?.lists)) {
            setProjectLists((listsData as any).lists.map((l: any) => ({ id: String(l.id), name: String(l.name) })));
          } else {
            setProjectLists([]);
          }

          if (tagsRes.ok && Array.isArray((tagsData as any)?.tags)) {
            setProjectTags(
              (tagsData as any).tags.map((t: any) => ({ id: String(t.id), name: String(t.name) }))
            );
          } else {
            setProjectTags([]);
          }
        } catch {
          setProjectLists([]);
          setProjectTags([]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch task details:", error);
      toast.error("Errore durante il caricamento del task");
    } finally {
      setLoading(false);
    }
  };

  const updateTaskMeta = async (
    patch: Record<string, any>,
    opts?: { successMessage?: string; silent?: boolean }
  ) => {
    setIsSavingMeta(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Update failed");
      }
      if (!opts?.silent) toast.success(opts?.successMessage || "Aggiornato");
      await fetchTaskDetails();
      onUpdate?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento");
    } finally {
      setIsSavingMeta(false);
    }
  };

  const saveTaskTitle = async () => {
    const nextTitle = taskDraftTitle.trim();
    if (!nextTitle) {
      toast.error("Titolo richiesto");
      return;
    }
    if (nextTitle === String(task?.title || "")) {
      setIsEditingTaskTitle(false);
      return;
    }
    setSavingTaskTitle(true);
    try {
      await updateTaskMeta({ title: nextTitle }, { successMessage: "Titolo aggiornato" });
      setIsEditingTaskTitle(false);
    } finally {
      setSavingTaskTitle(false);
    }
  };

  const toggleArchiveTask = async () => {
    if (!task) return;
    const isArchived = String(task.status || "") === "archived";
    const ok = confirm(
      isArchived
        ? `Ripristinare la task "${task.title}"?`
        : `Archiviare la task "${task.title}"?`
    );
    if (!ok) return;
    const nextStatus = isArchived ? "todo" : "archived";
    await updateTaskMeta(
      { status: nextStatus },
      { successMessage: isArchived ? "Task ripristinata" : "Task archiviata" }
    );
    if (!isArchived) {
      // normalmente le task archiviate spariscono dalla lista: chiudiamo il drawer per coerenza
      onClose();
    }
  };

  const deleteThisTask = async () => {
    if (!task) return;
    const ok = confirm(`Eliminare definitivamente la task "${task.title}"?`);
    if (!ok) return;
    setIsDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Eliminazione fallita");
      toast.success("Task eliminata");
      onUpdate?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eliminazione fallita");
    } finally {
      setIsDeletingTask(false);
    }
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtask }),
      });

      if (res.ok) {
        const subtask = await res.json();
        setSubtasks([...subtasks, subtask]);
        setNewSubtask("");
        toast.success("Subtask aggiunto");
      }
    } catch (error) {
      toast.error("Errore durante l'aggiunta del subtask");
    }
  };

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore aggiornamento subtask");

        setSubtasks(subtasks.map(st => 
        st.id === subtaskId
          ? { ...st, completed, status: completed ? "done" : "todo" }
          : st
        ));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'aggiornamento del subtask");
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    const ok = confirm("Eliminare subtask?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Eliminazione fallita");
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
      if (selectedSubtask?.id === subtaskId) {
        setSelectedSubtask(null);
        setSubtaskDetailOpen(false);
      }
      toast.success("Subtask eliminata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eliminazione fallita");
    }
  };

  const addComment = async () => {
    const contentHtml = newCommentHtml.trim();
    if (!contentHtml) return;

    setIsSendingComment(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentHtml, mentionedUserIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore durante l'aggiunta del commento");
      setComments((prev) => [...prev, data as any]);
      setNewCommentHtml("");
      setMentionedUserIds([]);
        toast.success("Commento aggiunto");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'aggiunta del commento");
    } finally {
      setIsSendingComment(false);
    }
  };

  const startEditComment = (c: Comment) => {
    setEditingCommentId(c.id);
    setEditingCommentHtml(c.content || "");
    setEditingMentionedUserIds([]);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentHtml("");
    setEditingMentionedUserIds([]);
  };

  const saveCommentEdit = async () => {
    if (!editingCommentId) return;
    const contentHtml = editingCommentHtml.trim();
    if (!contentHtml) return;
    setSavingCommentEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${editingCommentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentHtml, mentionedUserIds: editingMentionedUserIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore salvataggio");
      setComments((prev) => prev.map((c) => (c.id === editingCommentId ? (data as any) : c)));
      cancelEditComment();
      toast.success("Commento aggiornato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("Eliminare questo commento?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore eliminazione");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingCommentId === commentId) cancelEditComment();
      toast.success("Commento eliminato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    }
  };

  const uploadAttachment = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("taskId", taskId);

    setUploading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const attachment = await res.json();
        setAttachments([...attachments, attachment]);
        toast.success("File caricato");
      }
    } catch (error) {
      toast.error("Errore durante il caricamento del file");
    } finally {
      setUploading(false);
    }
  };

  const fetchSubtaskDetails = async (subtaskId: string) => {
    try {
      const [aRes, cRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/attachments`, { cache: "no-store" }),
        fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/comments`, { cache: "no-store" }),
      ]);
      const [aData, cData] = await Promise.all([aRes.json(), cRes.json()]);
      setSubtaskAttachments(Array.isArray(aData) ? aData : []);
      setSubtaskComments(Array.isArray(cData) ? cData : []);
    } catch {
      setSubtaskAttachments([]);
      setSubtaskComments([]);
    }
  };

  const saveSubtaskDescription = async () => {
    if (!selectedSubtask) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${selectedSubtask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: subtaskDraftDescription }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Salvataggio fallito");
      }
      toast.success("Descrizione subtask salvata");
      setSelectedSubtask((prev) => (prev ? { ...prev, description: subtaskDraftDescription } : prev));
      setSubtasks((prev) => prev.map((s) => (s.id === selectedSubtask.id ? { ...s, description: subtaskDraftDescription } : s)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Salvataggio fallito");
    }
  };

  const updateSelectedSubtaskMeta = async (patch: Record<string, any>) => {
    if (!selectedSubtask) return;
    const subtaskId = selectedSubtask.id;
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Aggiornamento fallito");

      const nextAssigneeId =
        (data as any)?.assigneeId !== undefined ? (data as any).assigneeId : patch.assigneeId;
      const nextAssignee =
        typeof nextAssigneeId === "string" && nextAssigneeId
          ? memberUsers.find((u: any) => u?.id === nextAssigneeId) || null
          : nextAssigneeId === null
            ? null
            : undefined;

      setSelectedSubtask((prev) =>
        prev && prev.id === subtaskId
          ? { ...(prev as any), ...(data as any), ...(nextAssignee !== undefined ? { assignee: nextAssignee } : {}) }
          : prev
      );
      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === subtaskId
            ? { ...(s as any), ...(data as any), ...(nextAssignee !== undefined ? { assignee: nextAssignee } : {}) }
            : s
        )
      );
      toast.success("Subtask aggiornata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aggiornamento fallito");
    }
  };

  const saveSubtaskTitle = async () => {
    if (!selectedSubtask) return;
    const title = subtaskDraftTitle.trim();
    if (!title) {
      toast.error("Titolo richiesto");
      return;
    }
    if (title === selectedSubtask.title) {
      setIsEditingSubtaskTitle(false);
      return;
    }
    setSavingSubtaskTitle(true);
    try {
      await updateSelectedSubtaskMeta({ title });
      setIsEditingSubtaskTitle(false);
    } finally {
      setSavingSubtaskTitle(false);
    }
  };

  const addSelectedSubtaskDependency = async (dependsOnId: string) => {
    if (!selectedSubtask) return;
    try {
      const res = await fetch(`/api/subtasks/${selectedSubtask.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore aggiunta dipendenza");
      setSelectedSubtask((prev) =>
        prev
          ? {
              ...(prev as any),
              dependencies: [...(prev.dependencies || []), data as any],
            }
          : prev
      );
      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === selectedSubtask.id
            ? { ...(s as any), dependencies: [...(s.dependencies || []), data as any] }
            : s
        )
      );
      toast.success("Dipendenza aggiunta");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore aggiunta dipendenza");
      if (selectedSubtask?.id) {
        void fetchSubtaskDetails(selectedSubtask.id);
      }
    }
  };

  const removeSelectedSubtaskDependency = async (dependencyId: string) => {
    if (!selectedSubtask) return;
    try {
      const res = await fetch(`/api/subtasks/dependencies/${dependencyId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore rimozione dipendenza");

      setSelectedSubtask((prev) =>
        prev
          ? {
              ...(prev as any),
              dependencies: (prev.dependencies || []).filter((d: any) => d.id !== dependencyId),
            }
          : prev
      );
      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === selectedSubtask.id
            ? { ...(s as any), dependencies: (s.dependencies || []).filter((d: any) => d.id !== dependencyId) }
            : s
        )
      );
      toast.success("Dipendenza rimossa");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore rimozione dipendenza");
      if (selectedSubtask?.id) {
        void fetchSubtaskDetails(selectedSubtask.id);
      }
    }
  };

  const uploadSubtaskAttachment = async (file: File) => {
    if (!selectedSubtask) return null;
    const fd = new FormData();
    fd.append("file", file);
    setSubtaskUploading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/attachments`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload fallito");
      setSubtaskAttachments((prev) => [data, ...prev]);
      toast.success("File caricato");
      return data as SubtaskAttachment;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fallito");
      return null;
    } finally {
      setSubtaskUploading(false);
    }
  };

  const addSubtaskComment = async () => {
    if (!selectedSubtask) return;
    if (!canWriteTask) {
      toast.error("Non hai permessi per commentare");
      return;
    }
    const contentHtml = subtaskNewCommentHtml.trim();
    if (!contentHtml || isEffectivelyEmptyRichHtmlClient(contentHtml)) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentHtml, mentionedUserIds: subtaskMentionedUserIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Commento fallito");
      setSubtaskComments((prev) => [...prev, data]);
      setSubtaskNewCommentHtml("");
      setSubtaskMentionedUserIds([]);
      toast.success("Commento aggiunto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commento fallito");
    }
  };

  const startEditSubtaskComment = (c: SubtaskComment) => {
    setEditingSubtaskCommentId(c.id);
    setEditingSubtaskCommentHtml(c.content || "");
    setEditingSubtaskMentionedUserIds([]);
  };

  const cancelEditSubtaskComment = () => {
    setEditingSubtaskCommentId(null);
    setEditingSubtaskCommentHtml("");
    setEditingSubtaskMentionedUserIds([]);
  };

  const saveSubtaskCommentEdit = async () => {
    if (!selectedSubtask) return;
    if (!editingSubtaskCommentId) return;
    const contentHtml = editingSubtaskCommentHtml.trim();
    if (!contentHtml || isEffectivelyEmptyRichHtmlClient(contentHtml)) return;
    setSavingSubtaskCommentEdit(true);
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/comments/${editingSubtaskCommentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: contentHtml, mentionedUserIds: editingSubtaskMentionedUserIds }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore salvataggio");
      setSubtaskComments((prev) => prev.map((c) => (c.id === editingSubtaskCommentId ? (data as any) : c)));
      cancelEditSubtaskComment();
      toast.success("Commento aggiornato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingSubtaskCommentEdit(false);
    }
  };

  const deleteSubtaskComment = async (commentId: string) => {
    if (!selectedSubtask) return;
    const ok = confirm("Eliminare commento?");
    if (!ok) return;
    setSavingSubtaskCommentEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Errore eliminazione");
      setSubtaskComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingSubtaskCommentId === commentId) cancelEditSubtaskComment();
      toast.success("Commento eliminato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    } finally {
      setSavingSubtaskCommentEdit(false);
    }
  };

  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const totalSubtasks = subtasks.length;

  const projectMembers: Array<any> = Array.isArray(task?.project?.members) ? task.project.members : [];
  const memberUsers = projectMembers.map((m: any) => m.user).filter(Boolean);
  const mentionUsers: MentionUser[] = memberUsers
    .map((u: any) => {
      const label =
        String(u?.name || `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.email || "").trim() || "Utente";
      return { id: String(u?.id || ""), label, email: u?.email || null, image: u?.image || null } as MentionUser;
    })
    .filter((u: MentionUser) => u.id);
  const userNameById = (id: string) => {
    const u = memberUsers.find((x: any) => x?.id === id);
    if (!u) return null;
    return u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
  };
  const currentAssigneeIds = Array.isArray(task?.assignees) ? task.assignees.map((a: any) => a.userId) : [];
  const currentAssigneeKey = currentAssigneeIds.join(",");

  useEffect(() => {
    if (!task) return;
    setDraftAssigneeIds(currentAssigneeIds);
    setTaskDraftTitle(String(task?.title || ""));
    setIsEditingTaskTitle(false);
  }, [taskId, task?.updatedAt, currentAssigneeKey, task]);

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-5xl max-h-[90vh] max-h-[90dvh] overflow-hidden p-0">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!task) return null;

  const globalRole = ((session?.user as any)?.role as string | undefined) || "member";
  const meId = (session?.user as any)?.id as string | undefined;
  const myMembership = Boolean(meId) && Array.isArray(task?.project?.members)
    ? task.project.members.find((m: any) => m?.userId === meId) || null
    : null;
  const isMeProjectMember = Boolean(myMembership);
  const myProjectRole = myMembership?.role ? String(myMembership.role) : "";
  const isMeProjectManager = myProjectRole === "owner" || myProjectRole === "manager";
  const isMeAssignee =
    Boolean(meId) &&
    Array.isArray(task?.assignees) &&
    task.assignees.some((a: any) => a?.user?.id === meId || a?.userId === meId);
  const canEditMeta = globalRole === "admin" || isMeProjectManager || (globalRole === "manager" && isMeProjectMember);
  const canEditStatus = canEditMeta || (globalRole === "member" && isMeAssignee);
  const canWriteTask =
    globalRole === "admin" ||
    isMeProjectManager ||
    (globalRole === "manager" && isMeProjectMember) ||
    (globalRole === "member" && isMeAssignee);
  const canDeleteSubtask = globalRole === "admin" || isMeProjectManager;
  const canAssignSubtask = globalRole === "admin" || isMeProjectManager;
  const canManageSubtaskChecklists = globalRole === "admin" || isMeProjectManager;

  const canManageProjectTags = globalRole === "admin" || isMeProjectManager;
  const currentProjectId = String(task?.project?.id || task?.projectId || "");

  const legacyTags: string[] = (() => {
    try {
      const parsed = typeof task?.legacyTags === "string" ? JSON.parse(task.legacyTags) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();

  const selectedTags: Array<{ id: string; name: string }> = Array.isArray(task?.tags)
    ? task.tags.map((t: any) => ({ id: String(t?.id || ""), name: String(t?.name || "") })).filter((t: any) => t.id && t.name)
    : [];
  const displayTagNames: string[] =
    selectedTags.length > 0 ? selectedTags.map((t) => t.name) : legacyTags;

  const amountLabel = typeof task?.amountCents === "number" ? formatEurCents(task.amountCents) : null;

  const filteredProjectTags = projectTags.filter((t) => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return true;
    return String(t.name || "").toLowerCase().includes(q);
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-orange-100 text-orange-700 border-orange-200";
      case "low": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": return "bg-green-100 text-green-700";
      case "in_progress": return "bg-orange-100 text-orange-700";
      case "todo": return "bg-gray-100 text-gray-700";
      case "archived": return "bg-muted text-muted-foreground";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const normalizeProjectTagName = (input: string): string =>
    String(input || "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();

  const refreshTags = async () => {
    if (!currentProjectId) return;
    const res = await fetch(`/api/projects/${currentProjectId}/tags`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray((data as any)?.tags)) {
      setProjectTags((data as any).tags.map((t: any) => ({ id: String(t.id), name: String(t.name) })));
    }
  };

  const createTag = async () => {
    if (!currentProjectId) return;
    if (!canManageProjectTags) {
      toast.error("Solo admin o project owner/manager possono creare tag.");
      return;
    }
    const name = normalizeProjectTagName(newTagName);
    if (!name) return;
    setTagMutationBusy(true);
    try {
      const res = await fetch(`/api/projects/${currentProjectId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        await refreshTags();
        const existing = projectTags.find((t) => t.name === name);
        if (existing) setDraftTagIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
        toast.success("Tag già presente");
        setNewTagName("");
        return;
      }
      if (!res.ok) throw new Error((data as any)?.error || "Impossibile creare tag");
      const created = (data as any)?.tag;
      if (created?.id) {
        const tag = { id: String(created.id), name: String(created.name || name) };
        setProjectTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
        setDraftTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
      } else {
        await refreshTags();
      }
      setNewTagName("");
      toast.success("Tag creato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile creare tag");
    } finally {
      setTagMutationBusy(false);
    }
  };

  const startRenameTag = (tagId: string) => {
    const t = projectTags.find((x) => x.id === tagId);
    if (!t) return;
    setRenamingTagId(tagId);
    setRenamingTagName(t.name);
  };

  const saveRenameTag = async () => {
    if (!currentProjectId || !renamingTagId) return;
    if (!canManageProjectTags) return;
    const name = normalizeProjectTagName(renamingTagName);
    if (!name) return;
    setTagMutationBusy(true);
    try {
      const res = await fetch(`/api/projects/${currentProjectId}/tags/${renamingTagId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Impossibile rinominare tag");
      setProjectTags((prev) => prev.map((t) => (t.id === renamingTagId ? { ...t, name } : t)).sort((a, b) => a.name.localeCompare(b.name)));
      setRenamingTagId(null);
      setRenamingTagName("");
      toast.success("Tag aggiornato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile rinominare tag");
    } finally {
      setTagMutationBusy(false);
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!currentProjectId) return;
    if (!canManageProjectTags) return;
    const t = projectTags.find((x) => x.id === tagId);
    if (!t) return;
    if (!confirm(`Eliminare il tag “${t.name}”? Verrà rimosso anche dalle task.`)) return;
    setTagMutationBusy(true);
    try {
      const res = await fetch(`/api/projects/${currentProjectId}/tags/${tagId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Impossibile eliminare tag");
      setProjectTags((prev) => prev.filter((x) => x.id !== tagId));
      setDraftTagIds((prev) => prev.filter((x) => x !== tagId));
      toast.success("Tag eliminato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile eliminare tag");
    } finally {
      setTagMutationBusy(false);
    }
  };

  const saveSelectedTags = async () => {
    await updateTaskMeta(
      { tagIds: draftTagIds, tags: null },
      { successMessage: "Tags aggiornati" }
    );
  };

  const saveAmount = async () => {
    const raw = draftAmountInput.trim();
    if (!raw) {
      await updateTaskMeta({ amountCents: null }, { successMessage: "Importo rimosso" });
      setAmountPickerOpen(false);
      return;
    }
    const cents = parseEurToCents(raw);
    if (cents === null) {
      toast.error("Importo non valido");
      return;
    }
    await updateTaskMeta({ amountCents: cents }, { successMessage: "Importo aggiornato" });
    setAmountPickerOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[95vw] sm:max-w-6xl h-full overflow-hidden p-0">
        <div className="flex h-full flex-col">
          <div className="border-b bg-background">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === "todo" && "Da Fare"}
                      {task.status === "in_progress" && "In Corso"}
                      {task.status === "done" && "Completato"}
                      {task.status === "archived" && "Archiviata"}
                    </Badge>
                    {task.taskList?.name || task.list ? (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <List className="w-3 h-3" />
                        {task.taskList?.name || task.list}
                      </Badge>
                    ) : null}
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority === "high" && "Alta"}
                      {task.priority === "medium" && "Media"}
                      {task.priority === "low" && "Bassa"}
                    </Badge>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    {isEditingTaskTitle ? (
                      <div className="flex-1 flex items-start gap-2">
                        <Input
                          value={taskDraftTitle}
                          onChange={(e) => setTaskDraftTitle(e.target.value)}
                          disabled={!canEditMeta || isSavingMeta || savingTaskTitle}
                          className="h-10"
                        />
                        <Button
                          type="button"
                          onClick={saveTaskTitle}
                          disabled={!canEditMeta || isSavingMeta || savingTaskTitle || !taskDraftTitle.trim()}
                        >
                          Salva
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setIsEditingTaskTitle(false);
                            setTaskDraftTitle(String(task?.title || ""));
                          }}
                          disabled={savingTaskTitle}
                        >
                          Annulla
                        </Button>
                </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold pr-2 truncate">{task.title}</div>
                        {canEditMeta ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => {
                                setTaskDraftTitle(String(task?.title || ""));
                                setIsEditingTaskTitle(true);
                              }}
                              aria-label="Modifica titolo task"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => void toggleArchiveTask()}
                              aria-label={task.status === "archived" ? "Ripristina task" : "Archivia task"}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive"
                              onClick={() => void deleteThisTask()}
                              disabled={isDeletingTask}
                              aria-label="Elimina task"
                            >
                              {isDeletingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
              </div>
                        ) : null}
                      </>
                    )}
                  </div>
                  {task.description ? (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{task.description}</p>
                  ) : null}
              </div>
            </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Assignees */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                    <Users className="w-3 h-3" />
                    Assignees
                  </Label>
                  <div className="flex items-center gap-1 flex-wrap">
                    {task.assignees?.map((assignee: any) => (
                      <Avatar key={assignee.user.id} className="w-8 h-8">
                        <AvatarImage src={assignee.user.image || undefined} />
                        <AvatarFallback>
                          {assignee.user.name?.[0] || assignee.user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {(!task.assignees || task.assignees.length === 0) ? (
                      <span className="text-sm text-muted-foreground">Add</span>
                    ) : null}
                        </div>

                  {canEditMeta ? (
                    <div className="mt-3">
                      <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" disabled={isSavingMeta}>
                            Modifica
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3" align="start">
                          <div className="text-sm font-medium mb-2">Seleziona assignees</div>
                          <div className="max-h-56 overflow-auto space-y-2">
                            {memberUsers.map((u: any) => {
                              const label =
                                u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
                              const checked = draftAssigneeIds.includes(u.id);
                              return (
                                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setDraftAssigneeIds((prev) =>
                                        e.target.checked
                                          ? Array.from(new Set([...prev, u.id]))
                                          : prev.filter((x: string) => x !== u.id)
                                      );
                                    }}
                                  />
                                  <span className="truncate">{label}</span>
                                </label>
                              );
                            })}
                            {memberUsers.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nessun membro progetto</p>
                            ) : null}
                      </div>

                          <div className="mt-3 flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSavingMeta}
                              onClick={() => {
                                setDraftAssigneeIds(currentAssigneeIds);
                                setAssigneePickerOpen(false);
                              }}
                            >
                              Annulla
                            </Button>
                            <Button
                              size="sm"
                              disabled={isSavingMeta}
                              onClick={() =>
                                updateTaskMeta({ assigneeIds: draftAssigneeIds }).then(() =>
                                  setAssigneePickerOpen(false)
                                )
                              }
                            >
                              Salva
                            </Button>
                    </div>
                        </PopoverContent>
                      </Popover>
                </div>
              ) : null}
                </div>

                {/* Dates */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                    <Calendar className="w-3 h-3" />
                    Dates
                  </Label>
                  <div className="space-y-2">
                    {task.dueDate ? (
                      <Badge variant="outline" className="text-sm">
                        {format(new Date(task.dueDate), "PPP", { locale: it })}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Add</span>
                    )}

                    {canEditMeta ? (
                      <Input
                        type="date"
                        disabled={isSavingMeta}
                        value={task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) {
                            updateTaskMeta({ dueDate: null });
                            return;
                          }
                          updateTaskMeta({ dueDate: `${v}T12:00:00Z` });
                        }}
                      />
                    ) : null}
                        </div>
                      </div>

                {/* Tags */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                    <Tag className="w-3 h-3" />
                    Tags
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {displayTagNames.length === 0 ? <span className="text-sm text-muted-foreground">Add</span> : null}
                    {displayTagNames.slice(0, 6).map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                    {displayTagNames.length > 6 ? (
                      <Badge variant="outline">+{displayTagNames.length - 6}</Badge>
                    ) : null}
                  </div>

                  {canEditMeta ? (
                    <div className="mt-3">
                      <Popover
                        open={tagsPickerOpen}
                        onOpenChange={(o) => {
                          setTagsPickerOpen(o);
                          if (o) {
                            const currentIds = selectedTags.map((t) => t.id);
                            if (currentIds.length > 0) {
                              setDraftTagIds(currentIds);
                            } else if (legacyTags.length > 0) {
                              const mapped = legacyTags
                                .map((name) => {
                                  const n = normalizeProjectTagName(String(name));
                                  return projectTags.find((t) => t.name === n)?.id || null;
                                })
                                .filter(Boolean) as string[];
                              setDraftTagIds(Array.from(new Set(mapped)));
                            } else {
                              setDraftTagIds([]);
                            }
                            setTagQuery("");
                            setNewTagName("");
                            setRenamingTagId(null);
                            setRenamingTagName("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" disabled={isSavingMeta}>
                            Modifica
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 p-3" align="start">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-sm font-medium">Tags</div>
                            {!canManageProjectTags ? (
                              <Badge variant="outline" className="text-[10px]">
                                Solo owner/admin può creare
                              </Badge>
                            ) : null}
                          </div>

                          <Input
                            value={tagQuery}
                            onChange={(e) => setTagQuery(e.target.value)}
                            placeholder="Cerca tag…"
                            className="h-9"
                          />

                          <div className="mt-2 max-h-56 overflow-auto space-y-1">
                            {filteredProjectTags.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-2">Nessun tag</div>
                            ) : (
                              filteredProjectTags.map((t) => {
                                const checked = draftTagIds.includes(t.id);
                                const isRenaming = renamingTagId === t.id;
                                return (
                                  <div
                                    key={t.id}
                                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/30"
                                  >
                                    <label className="flex items-center gap-2 text-sm cursor-pointer min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          setDraftTagIds((prev) =>
                                            e.target.checked
                                              ? Array.from(new Set([...prev, t.id]))
                                              : prev.filter((x) => x !== t.id)
                                          );
                                        }}
                                      />
                                      {isRenaming ? (
                                        <Input
                                          value={renamingTagName}
                                          onChange={(e) => setRenamingTagName(e.target.value)}
                                          className="h-8"
                                          disabled={tagMutationBusy}
                                          onKeyDown={(e) => {
                                            if (e.key === "Escape") {
                                              e.preventDefault();
                                              setRenamingTagId(null);
                                              setRenamingTagName("");
                                            }
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              void saveRenameTag();
                                            }
                                          }}
                                        />
                                      ) : (
                                        <span className="truncate">{t.name}</span>
                                      )}
                                    </label>

                                    {canManageProjectTags ? (
                                      isRenaming ? (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void saveRenameTag()}
                                            disabled={tagMutationBusy || !normalizeProjectTagName(renamingTagName)}
                                          >
                                            Salva
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setRenamingTagId(null);
                                              setRenamingTagName("");
                                            }}
                                            disabled={tagMutationBusy}
                                          >
                                            Annulla
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => startRenameTag(t.id)}
                                            disabled={tagMutationBusy}
                                            aria-label="Rinomina tag"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => void deleteTag(t.id)}
                                            disabled={tagMutationBusy}
                                            aria-label="Elimina tag"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {canManageProjectTags ? (
                            <div className="mt-3 border-t pt-3">
                              <div className="text-xs font-semibold text-muted-foreground mb-2">Crea nuovo tag</div>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={newTagName}
                                  onChange={(e) => setNewTagName(e.target.value)}
                                  placeholder="Es. PAGATO"
                                  className="h-9"
                                  disabled={tagMutationBusy}
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter") return;
                                    e.preventDefault();
                                    void createTag();
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void createTag()}
                                  disabled={tagMutationBusy || !normalizeProjectTagName(newTagName)}
                                >
                                  {tagMutationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-3 flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSavingMeta}
                              onClick={() => {
                                setTagsPickerOpen(false);
                              }}
                            >
                              Annulla
                            </Button>
                            <Button
                              size="sm"
                              disabled={isSavingMeta}
                              onClick={() => void saveSelectedTags().then(() => setTagsPickerOpen(false))}
                            >
                              Salva
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : null}
                </div>

                {/* Importo */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                    <Hash className="w-3 h-3" />
                    Importo
                  </Label>
                  <div className="space-y-2">
                    {amountLabel ? (
                      <Badge variant="outline" className="text-sm">
                        {amountLabel}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Add</span>
                    )}

                    {canEditMeta ? (
                      <Popover
                        open={amountPickerOpen}
                        onOpenChange={(o) => {
                          setAmountPickerOpen(o);
                          if (o) {
                            setDraftAmountInput(amountLabel || "");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" disabled={isSavingMeta}>
                            Modifica
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3" align="start">
                          <div className="text-sm font-medium mb-2">Importo (EUR)</div>
                          <Input
                            value={draftAmountInput}
                            onChange={(e) => setDraftAmountInput(e.target.value)}
                            placeholder="Es. 1.234,56"
                            disabled={isSavingMeta}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void saveAmount();
                              }
                            }}
                          />
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSavingMeta}
                              onClick={() => {
                                setDraftAmountInput("");
                                void updateTaskMeta({ amountCents: null }, { successMessage: "Importo rimosso" }).then(() =>
                                  setAmountPickerOpen(false)
                                );
                              }}
                            >
                              Rimuovi
                            </Button>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isSavingMeta}
                                onClick={() => setAmountPickerOpen(false)}
                              >
                                Annulla
                              </Button>
                              <Button size="sm" disabled={isSavingMeta} onClick={() => void saveAmount()}>
                                Salva
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </div>
                </div>

                {/* List/Category */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                    <List className="w-3 h-3" />
                    List
                  </Label>
                  <div className="space-y-2">
                    {task.taskList?.name || task.list ? (
                      <Badge variant="outline" className="text-sm">
                        {task.taskList?.name || task.list}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Add</span>
                    )}

                    {canEditMeta ? (
                      <Select
                        value={task.listId || ""}
                        onValueChange={(v) => updateTaskMeta({ listId: v || null })}
                        disabled={isSavingMeta || projectLists.length === 0}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={projectLists.length === 0 ? "Categorie non disponibili" : "Seleziona"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {projectLists.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </div>

                {/* Status */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Status
                  </Label>
                  <div className="space-y-2">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === "todo" && "Da Fare"}
                      {task.status === "in_progress" && "In Corso"}
                      {task.status === "done" && "Completato"}
                      {task.status === "archived" && "Archiviata"}
                    </Badge>
                    <Select
                      value={task.status}
                      onValueChange={(v) => {
                        if (v === "archived" && !canEditMeta) {
                          toast.error("Solo admin o project owner/manager possono archiviare.");
                          return;
                        }
                        if (task.status === "archived" && v !== "archived" && !canEditMeta) {
                          toast.error("Solo admin o project owner/manager possono ripristinare.");
                          return;
                        }
                        updateTaskMeta(
                          { status: v },
                          { successMessage: v === "archived" ? "Task archiviata" : "Aggiornato" }
                        );
                      }}
                      disabled={!canEditStatus || isSavingMeta || (task.status === "archived" && !canEditMeta)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">Da Fare</SelectItem>
                        <SelectItem value="in_progress">In Corso</SelectItem>
                        <SelectItem value="done">Completato</SelectItem>
                        <SelectItem value="archived" disabled={!canEditMeta}>
                          Archiviata
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList>
                    <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                    <TabsTrigger value="comments">Comments</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {activeTab === "subtasks" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Subtasks
                      <span className="text-muted-foreground">
                          {completedSubtasks} / {totalSubtasks}
                        </span>
                      </h3>
                    {totalSubtasks > 0 ? (
                      <div className="w-40 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                          className="h-full bg-success transition-all"
                            style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                          />
                        </div>
                    ) : null}
                    </div>

                    <div className="space-y-2">
                    {subtasks.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nessuna subtask.</div>
                    ) : null}
                      {subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                        onClick={() => {
                          setSelectedSubtask(subtask);
                          setSubtaskDetailOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSubtask(subtask);
                            setSubtaskDetailOpen(true);
                          }
                        }}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={subtask.completed}
                            disabled={!canWriteTask}
                            onCheckedChange={(checked) => toggleSubtask(subtask.id, !!checked)}
                          />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className={subtask.completed ? "line-through text-muted-foreground" : ""}>
                            {subtask.title}
                          </div>
                        </div>
                        {canDeleteSubtask ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive"
                              onClick={() => void deleteSubtask(subtask.id)}
                              aria-label="Elimina subtask"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                        </div>
                      ))}
                  </div>

                  <div className="flex items-center gap-2">
                        <Input
                          placeholder="Aggiungi un subtask..."
                          value={newSubtask}
                          onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && canWriteTask && addSubtask()}
                          className="flex-1"
                      disabled={!canWriteTask}
                        />
                    <Button onClick={addSubtask} size="sm" variant="outline" disabled={!canWriteTask}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
              ) : null}

              {activeTab === "attachments" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Allegati
                      <span className="text-muted-foreground">({attachments.length})</span>
                    </h3>
                  </div>

                    <div className="space-y-2">
                    {attachments.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nessun allegato.</div>
                    ) : null}
                    {attachments.map((attachment) => {
                      const href = getHrefForFilePath(attachment.filePath) || "#";
                      const isImg = isProbablyImageFile(attachment.fileName, attachment.mimeType);
                      const previewSrc = isImg ? getImageSrcForFilePath(attachment.filePath) : null;
                      return (
                        <a
                          key={attachment.id}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                        >
                          {previewSrc ? (
                            <img
                              src={previewSrc}
                              alt={attachment.fileName}
                              className="h-9 w-9 rounded object-cover border bg-muted"
                              loading="lazy"
                            />
                          ) : (
                            <Paperclip className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(attachment.fileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </a>
                      );
                    })}

                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">
                          {uploading ? "Caricamento..." : "Trascina file o clicca per caricare"}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>
              ) : null}

              {activeTab === "comments" ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Commenti
                    <span className="text-muted-foreground">({comments.length})</span>
                    </h3>

                    <div className="space-y-3">
                    {comments.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nessun commento.</div>
                    ) : null}
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={comment.user.image || undefined} />
                            <AvatarFallback>
                              {comment.user.name?.[0] || comment.user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium">{comment.user.name || comment.user.email}</p>
                              <div className="flex items-center gap-1">
                                {(canEditMeta || (meId && comment.user.id === meId)) ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => startEditComment(comment)}
                                      disabled={savingCommentEdit}
                                      aria-label="Modifica commento"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => deleteComment(comment.id)}
                                      disabled={savingCommentEdit}
                                      aria-label="Elimina commento"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : null}
                            </div>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-2 space-y-2">
                                <RichTextEditor
                                  valueHtml={editingCommentHtml}
                                  onChange={(html, ids) => {
                                    setEditingCommentHtml(html);
                                    setEditingMentionedUserIds(ids);
                                  }}
                                  mentionUsers={mentionUsers}
                                  placeholder="Modifica commento…"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={cancelEditComment}
                                    disabled={savingCommentEdit}
                                  >
                                    Annulla
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={saveCommentEdit}
                                    disabled={savingCommentEdit || !editingCommentHtml.trim()}
                                  >
                                    Salva
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <RichTextViewer
                                html={
                                  comment.content.includes("<")
                                    ? comment.content
                                    : comment.content.replace(/\n/g, "<br/>")
                                }
                                className="mt-2"
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(comment.createdAt), "PPp", { locale: it })}
                            </p>
                          </div>
                        </div>
                      ))}

                    <div className="space-y-2">
                      <RichTextEditor
                        valueHtml={newCommentHtml}
                        onChange={(html, ids) => {
                          setNewCommentHtml(html);
                          setMentionedUserIds(ids);
                        }}
                        mentionUsers={mentionUsers}
                        placeholder="Scrivi un commento…"
                        disabled={!canWriteTask || isSendingComment}
                      />
                      <Button onClick={addComment} className="w-full" disabled={!canWriteTask || !newCommentHtml.trim() || isSendingComment}>
                        {isSendingComment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Invia"}
                      </Button>
                    </div>
                  </div>
          </div>
              ) : null}

              {activeTab === "activity" ? (
                <div className="space-y-3">
                  {activityEvents.map((e) => (
                    <div key={e.id} className="flex gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={e.actor?.image || undefined} />
                      <AvatarFallback>
                          {(e.actor?.name?.[0] || e.actor?.email?.[0] || "U").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                      <div className="flex-1">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm font-medium">
                            {e.actor?.name || e.actor?.email || "Sistema"}
                          </p>
                          <p className="text-sm text-foreground/80 mt-1">
                            {formatTaskActivityEvent(e, userNameById).message}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(e.createdAt), "PPp", { locale: it })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {activityEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nessuna attività.</p>
                  ) : null}
                </div>
                          ) : null}
                        </div>
          </ScrollArea>
        </div>
      </SheetContent>

      <SideDrawer
        open={subtaskDetailOpen}
        onOpenChange={(next) => {
          setSubtaskDetailOpen(next);
          if (!next) setSelectedSubtask(null);
        }}
        contentClassName="z-[61] w-[95vw] sm:max-w-3xl h-full p-0 flex flex-col bg-background"
        overlayClassName="z-[60] bg-black/40"
      >
        <div className="p-6 border-b">
          <div className="text-xs text-muted-foreground">Subtask</div>
          <div className="mt-2 flex items-start justify-between gap-2">
            {isEditingSubtaskTitle ? (
              <div className="flex-1 flex items-start gap-2">
                <Input
                  value={subtaskDraftTitle}
                  onChange={(e) => setSubtaskDraftTitle(e.target.value)}
                  disabled={!selectedSubtask || !canWriteTask || savingSubtaskTitle}
                  className="h-10"
                />
                          <Button
                  type="button"
                  onClick={saveSubtaskTitle}
                  disabled={!selectedSubtask || !canWriteTask || savingSubtaskTitle || !subtaskDraftTitle.trim()}
                >
                  Salva
                </Button>
                <Button
                  type="button"
                            variant="ghost"
                            onClick={() => {
                    setIsEditingSubtaskTitle(false);
                    setSubtaskDraftTitle(selectedSubtask?.title || "");
                            }}
                  disabled={savingSubtaskTitle}
                          >
                            Annulla
                          </Button>
              </div>
            ) : (
              <>
                <div className="text-xl font-semibold">{selectedSubtask?.title || ""}</div>
                {selectedSubtask && canWriteTask ? (
                          <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      setSubtaskDraftTitle(selectedSubtask.title || "");
                      setIsEditingSubtaskTitle(true);
                    }}
                    aria-label="Modifica titolo subtask"
                  >
                    <Pencil className="h-4 w-4" />
                          </Button>
                ) : null}
              </>
            )}
                        </div>
                  </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
            <div className="font-semibold">Dettagli</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={
                    selectedSubtask?.status ||
                    (selectedSubtask?.completed ? "done" : "todo")
                  }
                  onValueChange={(v) => updateSelectedSubtaskMeta({ status: v })}
                  disabled={!selectedSubtask || !canWriteTask}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Da Fare</SelectItem>
                    <SelectItem value="in_progress">In Corso</SelectItem>
                    <SelectItem value="done">Completato</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Priorità</Label>
                <Select
                  value={selectedSubtask?.priority || "medium"}
                  onValueChange={(v) => updateSelectedSubtaskMeta({ priority: v })}
                  disabled={!selectedSubtask || !canWriteTask}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Priorità" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Due date</Label>
                    <Input
                      type="date"
                  value={
                    selectedSubtask?.dueDate
                      ? new Date(selectedSubtask.dueDate).toISOString().slice(0, 10)
                      : ""
                  }
                      onChange={(e) => {
                        const v = e.target.value;
                    updateSelectedSubtaskMeta({ dueDate: v ? new Date(v).toISOString() : null });
                  }}
                  disabled={!selectedSubtask || !canWriteTask}
                />
              </div>

              <div className="space-y-1">
                <Label>Assegnatario</Label>
                <Select
                  value={selectedSubtask?.assigneeId || "__none__"}
                  onValueChange={(v) => updateSelectedSubtaskMeta({ assigneeId: v === "__none__" ? null : v })}
                  disabled={!selectedSubtask || !canAssignSubtask}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuno</SelectItem>
                    {mentionUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                </div>
              </div>

          <Separator />

                <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Dipendenze
              </div>
            </div>

            {selectedSubtask && (selectedSubtask.dependencies || []).length > 0 ? (
              <div className="space-y-2">
                {(selectedSubtask.dependencies || []).map((d) => {
                  const dependsOn = subtasks.find((s) => s.id === d.dependsOnId);
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-2">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{dependsOn?.title || d.dependsOnId}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={!canWriteTask}
                        onClick={() => removeSelectedSubtaskDependency(d.id)}
                        aria-label="Rimuovi dipendenza"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nessuna dipendenza.</div>
            )}

            {selectedSubtask ? (
              <div className="space-y-2">
                <Label>Aggiungi dipendenza</Label>
                    <Select
                  value="__none__"
                  onValueChange={(v) => {
                    if (!selectedSubtask) return;
                    if (!v || v === "__none__") return;
                    void addSelectedSubtaskDependency(v);
                  }}
                  disabled={!canWriteTask}
                    >
                      <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleziona subtask" />
                      </SelectTrigger>
                      <SelectContent>
                    <SelectItem value="__none__">Seleziona…</SelectItem>
                    {subtasks
                      .filter((s) => s.id !== selectedSubtask.id)
                      .filter((s) => !(selectedSubtask.dependencies || []).some((d) => d.dependsOnId === s.id))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
              </div>
                  ) : null}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea
              value={subtaskDraftDescription}
              onChange={(e) => setSubtaskDraftDescription(e.target.value)}
              placeholder="Aggiungi una descrizione..."
              disabled={!selectedSubtask}
            />
            <div className="flex justify-end">
              <Button variant="outline" onClick={saveSubtaskDescription} disabled={!selectedSubtask}>
                Salva descrizione
              </Button>
                </div>
              </div>

          <Separator />

          <div className="space-y-2">
            {selectedSubtask ? (
              <SubtaskChecklists
                taskId={taskId}
                subtaskId={selectedSubtask.id}
                open={subtaskDetailOpen}
                disabled={!canManageSubtaskChecklists}
              />
            ) : null}
                </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Allegati</div>
              <label className="inline-flex items-center gap-2">
                <Input
                  type="file"
                  disabled={subtaskUploading || !selectedSubtask}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadSubtaskAttachment(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
                  </div>
            {subtaskUploading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Upload…
                </div>
            ) : null}
            {subtaskAttachments.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nessun allegato.</div>
            ) : (
              <div className="space-y-2">
                {subtaskAttachments.map((a) => {
                  const href = getHrefForFilePath(a.filePath) || "#";
                  const isImg = isProbablyImageFile(a.fileName, a.mimeType);
                  const previewSrc = isImg ? getImageSrcForFilePath(a.filePath) : null;
                  return (
                    <a
                      key={a.id}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 border rounded-lg p-2 hover:bg-muted/30"
                    >
                      {previewSrc ? (
                        <img
                          src={previewSrc}
                          alt={a.fileName}
                          className="h-9 w-9 rounded object-cover border bg-muted"
                          loading="lazy"
                        />
                      ) : (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{a.fileName}</div>
                        <div className="text-xs text-muted-foreground">{Math.round(a.fileSize / 1024)} KB</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="font-semibold">Commenti</div>
            {subtaskComments.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nessun commento.</div>
            ) : (
              <div className="space-y-3">
                {subtaskComments.map((c) => (
                  <div key={c.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {c.user?.name || c.user?.email || "Utente"} · {new Date(c.createdAt).toLocaleString()}
              </div>
                      {(canEditMeta || (meId && c.user?.id === meId)) ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEditSubtaskComment(c)}
                            disabled={savingSubtaskCommentEdit}
                            aria-label="Modifica commento"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => void deleteSubtaskComment(c.id)}
                            disabled={savingSubtaskCommentEdit}
                            aria-label="Elimina commento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
            </div>
                      ) : null}
          </div>

                    {editingSubtaskCommentId === c.id ? (
                      <div className="mt-2 space-y-2">
                        <RichTextEditor
                          valueHtml={editingSubtaskCommentHtml}
                          onChange={(html, ids) => {
                            setEditingSubtaskCommentHtml(html);
                            setEditingSubtaskMentionedUserIds(ids);
                          }}
                          mentionUsers={mentionUsers}
                          placeholder="Modifica commento…"
                          disabled={savingSubtaskCommentEdit}
                          onUploadImage={async (file) => {
                            const uploaded = await uploadSubtaskAttachment(file);
                            if (!uploaded) throw new Error("Upload fallito");
                            const src = getImageSrcForFilePath(uploaded.filePath) || uploaded.filePath;
                            return { src, alt: uploaded.fileName };
                          }}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={cancelEditSubtaskComment}
                            disabled={savingSubtaskCommentEdit}
                          >
                            Annulla
                          </Button>
                          <Button
                            type="button"
                            onClick={saveSubtaskCommentEdit}
                            disabled={
                              savingSubtaskCommentEdit ||
                              !editingSubtaskCommentHtml.trim() ||
                              isEffectivelyEmptyRichHtmlClient(editingSubtaskCommentHtml)
                            }
                          >
                            Salva
                          </Button>
        </div>
                      </div>
                    ) : (
                      <RichTextViewer
                        html={c.content.includes("<") ? c.content : c.content.replace(/\n/g, "<br/>")}
                        className="mt-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <RichTextEditor
                valueHtml={subtaskNewCommentHtml}
                onChange={(html, ids) => {
                  setSubtaskNewCommentHtml(html);
                  setSubtaskMentionedUserIds(ids);
                }}
                mentionUsers={mentionUsers}
                disabled={!selectedSubtask || !canWriteTask || savingSubtaskCommentEdit}
                placeholder="Scrivi un commento…"
                onUploadImage={async (file) => {
                  const uploaded = await uploadSubtaskAttachment(file);
                  if (!uploaded) throw new Error("Upload fallito");
                  const src = getImageSrcForFilePath(uploaded.filePath) || uploaded.filePath;
                  return { src, alt: uploaded.fileName };
                }}
              />
              <div className="flex justify-end">
                <Button
                  onClick={addSubtaskComment}
                  disabled={
                    !selectedSubtask ||
                    !canWriteTask ||
                    savingSubtaskCommentEdit ||
                    !subtaskNewCommentHtml.trim() ||
                    isEffectivelyEmptyRichHtmlClient(subtaskNewCommentHtml)
                  }
                >
                  Invia
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SideDrawer>
    </Sheet>
  );
}
