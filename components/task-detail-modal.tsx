"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { SideDrawer } from "@/components/side-drawer";
import { SubtaskChecklists } from "@/components/subtask-checklists";
import { 
  CheckCircle2, 
  Check,
  Circle, 
  Calendar,
  Tag,
  List,
  Paperclip,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Users,
  Hash,
  Clock,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

interface Subtask {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
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
  filePath: string;
  uploadedBy?: string;
  createdAt: string;
}

interface SubtaskAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  uploadedBy?: string;
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
  projectId: string;
  onUpdate?: () => void;
}

export function TaskDetailModal({ open, onClose, taskId, projectId, onUpdate }: TaskDetailModalProps) {
  const { data: session } = useSession();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"subtasks" | "attachments" | "comments" | "activity">("subtasks");
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>([]);
  const [tagsPickerOpen, setTagsPickerOpen] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftTagInput, setDraftTagInput] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [isSavingCommentEdit, setIsSavingCommentEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projectLists, setProjectLists] = useState<Array<{ id: string; name: string }>>([]);
  const [subtaskDetailOpen, setSubtaskDetailOpen] = useState(false);
  const [selectedSubtask, setSelectedSubtask] = useState<Subtask | null>(null);
  const [subtaskAttachments, setSubtaskAttachments] = useState<SubtaskAttachment[]>([]);
  const [subtaskComments, setSubtaskComments] = useState<SubtaskComment[]>([]);
  const [subtaskUploading, setSubtaskUploading] = useState(false);
  const [subtaskDraftDescription, setSubtaskDraftDescription] = useState("");
  const [subtaskNewComment, setSubtaskNewComment] = useState("");
  const [editingSubtaskCommentId, setEditingSubtaskCommentId] = useState<string | null>(null);
  const [editingSubtaskCommentDraft, setEditingSubtaskCommentDraft] = useState("");
  const [isSavingSubtaskCommentEdit, setIsSavingSubtaskCommentEdit] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [deletingSubtaskAttachmentId, setDeletingSubtaskAttachmentId] = useState<string | null>(null);

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails();
    }
  }, [open, taskId]);

  useEffect(() => {
    if (!open) return;
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setEditingCommentId(null);
    setEditingCommentDraft("");
    setEditingSubtaskCommentId(null);
    setEditingSubtaskCommentDraft("");
  }, [open, taskId]);

  useEffect(() => {
    if (!subtaskDetailOpen || !selectedSubtask) return;
    setSubtaskDraftDescription(selectedSubtask.description || "");
    void fetchSubtaskDetails(selectedSubtask.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtaskDetailOpen, selectedSubtask?.id]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      const [taskRes, subtasksRes, commentsRes, attachmentsRes, activityRes, listsRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/subtasks`),
        fetch(`/api/tasks/${taskId}/comments`),
        fetch(`/api/tasks/${taskId}/attachments`),
        fetch(`/api/tasks/${taskId}/activity`),
        fetch(`/api/projects/${projectId}/lists`, { cache: "no-store" }),
      ]);

      const [taskData, subtasksData, commentsData, attachmentsData, activityData, listsData] = await Promise.all([
        taskRes.json(),
        subtasksRes.json(),
        commentsRes.json(),
        attachmentsRes.json(),
        activityRes.json(),
        listsRes.json().catch(() => ({})),
      ]);

      setTask(taskData);
      setSubtasks(subtasksData);
      setComments(commentsData);
      setAttachments(attachmentsData);
      setActivityEvents(Array.isArray(activityData?.events) ? activityData.events : []);
      if (listsRes.ok && Array.isArray((listsData as any)?.lists)) {
        setProjectLists((listsData as any).lists.map((l: any) => ({ id: String(l.id), name: String(l.name) })));
      } else {
        setProjectLists([]);
      }
    } catch (error) {
      console.error("Failed to fetch task details:", error);
      toast.error("Errore durante il caricamento del task");
    } finally {
      setLoading(false);
    }
  };

  const updateTaskMeta = async (patch: Record<string, any>) => {
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
      toast.success("Aggiornato");
      await fetchTaskDetails();
      onUpdate?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento");
    } finally {
      setIsSavingMeta(false);
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

      if (res.ok) {
        setSubtasks(subtasks.map(st => 
          st.id === subtaskId ? { ...st, completed } : st
        ));
      }
    } catch (error) {
      toast.error("Errore durante l'aggiornamento del subtask");
    }
  };

  const addComment = async () => {
    const content = newComment.trim();
    if (!content) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Commento fallito");
      setComments((prev) => [...prev, data as Comment]);
      setNewComment("");
      toast.success("Commento aggiunto");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'aggiunta del commento");
    }
  };

  const saveCommentEdit = async (commentId: string) => {
    const content = editingCommentDraft.trim();
    if (!content) return;
    setIsSavingCommentEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Update fallito");
      setComments((prev) => prev.map((c) => (c.id === commentId ? (data as Comment) : c)));
      setEditingCommentId(null);
      setEditingCommentDraft("");
      toast.success("Commento aggiornato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update fallito");
    } finally {
      setIsSavingCommentEdit(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("Eliminare questo commento?")) return;
    setIsSavingCommentEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Eliminazione fallita");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentDraft("");
      }
      toast.success("Commento eliminato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eliminazione fallita");
    } finally {
      setIsSavingCommentEdit(false);
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

  const uploadSubtaskAttachment = async (file: File) => {
    if (!selectedSubtask) return;
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fallito");
    } finally {
      setSubtaskUploading(false);
    }
  };

  const addSubtaskComment = async () => {
    if (!selectedSubtask) return;
    const content = subtaskNewComment.trim();
    if (!content) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Commento fallito");
      setSubtaskComments((prev) => [...prev, data]);
      setSubtaskNewComment("");
      toast.success("Commento aggiunto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commento fallito");
    }
  };

  const saveSubtaskCommentEdit = async (commentId: string) => {
    if (!selectedSubtask) return;
    const content = editingSubtaskCommentDraft.trim();
    if (!content) return;
    setIsSavingSubtaskCommentEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Update fallito");
      setSubtaskComments((prev) => prev.map((c) => (c.id === commentId ? (data as SubtaskComment) : c)));
      setEditingSubtaskCommentId(null);
      setEditingSubtaskCommentDraft("");
      toast.success("Commento aggiornato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update fallito");
    } finally {
      setIsSavingSubtaskCommentEdit(false);
    }
  };

  const deleteSubtaskComment = async (commentId: string) => {
    if (!selectedSubtask) return;
    if (!confirm("Eliminare questo commento?")) return;
    setIsSavingSubtaskCommentEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Eliminazione fallita");
      setSubtaskComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingSubtaskCommentId === commentId) {
        setEditingSubtaskCommentId(null);
        setEditingSubtaskCommentDraft("");
      }
      toast.success("Commento eliminato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eliminazione fallita");
    } finally {
      setIsSavingSubtaskCommentEdit(false);
    }
  };

  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const totalSubtasks = subtasks.length;

  const projectMembers: Array<any> = Array.isArray(task?.project?.members) ? task.project.members : [];
  const memberUsers = projectMembers.map((m: any) => m.user).filter(Boolean);
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
    if (!isEditingTitle) setDraftTitle(task.title || "");
    if (!isEditingDescription) setDraftDescription(task.description || "");
    try {
      const parsed = typeof task?.tags === "string" ? JSON.parse(task.tags) : [];
      setDraftTags(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      setDraftTags([]);
    }
  }, [taskId, task?.updatedAt, currentAssigneeKey, task, isEditingTitle, isEditingDescription]);

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-hidden p-0">
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
  const isMeAssignee =
    Boolean(meId) &&
    Array.isArray(task?.assignees) &&
    task.assignees.some((a: any) => a?.user?.id === meId || a?.userId === meId);
  const myProjectMembership =
    Boolean(meId) && Array.isArray(task?.project?.members)
      ? task.project.members.find((m: any) => m?.userId === meId) || null
      : null;
  const isMeProjectMember = Boolean(myProjectMembership);
  const myProjectRole = myProjectMembership?.role ? String(myProjectMembership.role) : "";
  const isMeProjectManager = myProjectRole === "owner" || myProjectRole === "manager";
  const canEditMeta =
    globalRole === "admin" || (globalRole === "manager" && isMeProjectMember) || isMeProjectManager;
  const canEditStatus = canEditMeta || (globalRole === "member" && isMeAssignee);
  const canWriteTaskComment =
    globalRole === "admin" ||
    (globalRole === "manager" && isMeProjectMember) ||
    isMeProjectManager ||
    (globalRole === "member" && isMeAssignee);
  const canUploadTaskAttachment = canWriteTaskComment;

  const tags: string[] = (() => {
    try {
      const parsed = typeof task?.tags === "string" ? JSON.parse(task.tags) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();

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
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[95vw] sm:max-w-6xl h-full overflow-hidden p-0">
        <div className="flex h-full flex-col">
          <div className="border-b bg-background">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === "todo" && "Da Fare"}
                      {task.status === "in_progress" && "In Corso"}
                      {task.status === "done" && "Completato"}
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
                  {isEditingTitle ? (
                    <div className="mt-1 space-y-2 max-w-3xl">
                      <Input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        disabled={isSavingMeta}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={isSavingMeta || !draftTitle.trim()}
                          onClick={() => updateTaskMeta({ title: draftTitle }).then(() => setIsEditingTitle(false))}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Salva
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isSavingMeta}
                          onClick={() => {
                            setDraftTitle(task.title || "");
                            setIsEditingTitle(false);
                          }}
                        >
                          Annulla
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold pr-2 truncate">{task.title}</div>
                      {canEditMeta ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isSavingMeta}
                          onClick={() => {
                            setDraftTitle(task.title || "");
                            setIsEditingTitle(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                  {isEditingDescription ? (
                    <div className="mt-3 space-y-2 max-w-3xl">
                      <Textarea
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder="Aggiungi una descrizione…"
                        className="min-h-[110px]"
                        disabled={isSavingMeta}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isSavingMeta}
                          onClick={() => {
                            setDraftDescription(task.description || "");
                            setIsEditingDescription(false);
                          }}
                        >
                          Annulla
                        </Button>
                        <Button
                          size="sm"
                          disabled={isSavingMeta}
                          onClick={() =>
                            updateTaskMeta({ description: draftDescription }).then(() => setIsEditingDescription(false))
                          }
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Salva descrizione
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-start justify-between gap-2">
                      {task.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{task.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nessuna descrizione.</p>
                      )}
                      {canEditMeta ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          disabled={isSavingMeta}
                          onClick={() => {
                            setDraftDescription(task.description || "");
                            setIsEditingDescription(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
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

                {/* Priority */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                    <Hash className="w-3 h-3" />
                    Priority
                  </Label>
                  <div className="space-y-2">
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority === "high" && "Alta"}
                      {task.priority === "medium" && "Media"}
                      {task.priority === "low" && "Bassa"}
                    </Badge>

                    {canEditMeta ? (
                      <Select
                        value={task.priority}
                        onValueChange={(v) => updateTaskMeta({ priority: v })}
                        disabled={isSavingMeta}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Priorità" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="low">Bassa</SelectItem>
                        </SelectContent>
                      </Select>
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
                    {tags.length === 0 ? <span className="text-sm text-muted-foreground">Add</span> : null}
                    {tags.slice(0, 6).map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                    {tags.length > 6 ? <Badge variant="outline">+{tags.length - 6}</Badge> : null}
                  </div>

                  {canEditMeta ? (
                    <div className="mt-3">
                      <Popover
                        open={tagsPickerOpen}
                        onOpenChange={(o) => {
                          setTagsPickerOpen(o);
                          if (o) {
                            setDraftTags(tags);
                            setDraftTagInput("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" disabled={isSavingMeta}>
                            Modifica
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3" align="start">
                          <div className="text-sm font-medium mb-2">Tags</div>
                          <div className="flex flex-wrap gap-1">
                            {draftTags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                              >
                                {t}
                                <button
                                  type="button"
                                  className="opacity-70 hover:opacity-100"
                                  onClick={() => setDraftTags((prev) => prev.filter((x) => x !== t))}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            {draftTags.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Nessun tag</span>
                            ) : null}
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <Input
                              value={draftTagInput}
                              onChange={(e) => setDraftTagInput(e.target.value)}
                              placeholder="Nuovo tag…"
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                const next = draftTagInput.trim();
                                if (!next) return;
                                setDraftTags((prev) => (prev.includes(next) ? prev : [...prev, next]));
                                setDraftTagInput("");
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const next = draftTagInput.trim();
                                if (!next) return;
                                setDraftTags((prev) => (prev.includes(next) ? prev : [...prev, next]));
                                setDraftTagInput("");
                              }}
                            >
                              Add
                            </Button>
                          </div>

                          <div className="mt-3 flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSavingMeta}
                              onClick={() => {
                                setDraftTags(tags);
                                setDraftTagInput("");
                                setTagsPickerOpen(false);
                              }}
                            >
                              Annulla
                            </Button>
                            <Button
                              size="sm"
                              disabled={isSavingMeta}
                              onClick={() => updateTaskMeta({ tags: draftTags }).then(() => setTagsPickerOpen(false))}
                            >
                              Salva
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : null}
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
                    </Badge>
                    <Select
                      value={task.status}
                      onValueChange={(v) => updateTaskMeta({ status: v })}
                      disabled={!canEditStatus || isSavingMeta}
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
            <div className="p-4 sm:p-6">
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
                      <button
                        key={subtask.id}
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                        onClick={() => {
                          setSelectedSubtask(subtask);
                          setSubtaskDetailOpen(true);
                        }}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={subtask.completed}
                            onCheckedChange={(checked) => toggleSubtask(subtask.id, !!checked)}
                          />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className={subtask.completed ? "line-through text-muted-foreground" : ""}>
                            {subtask.title}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Aggiungi un subtask..."
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                      className="flex-1"
                    />
                    <Button onClick={addSubtask} size="sm" variant="outline">
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
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                      >
                        <a
                          href={attachment.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 flex-1 min-w-0"
                        >
                          <Paperclip className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(attachment.fileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </a>
                        {(() => {
                          const isUploader = Boolean(meId) && attachment.uploadedBy === meId;
                          const canDelete = canEditMeta || isUploader;
                          if (!canDelete) return null;
                          return (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              disabled={deletingAttachmentId === attachment.id || uploading}
                              onClick={async () => {
                                if (!confirm("Eliminare questo allegato?")) return;
                                setDeletingAttachmentId(attachment.id);
                                try {
                                  const res = await fetch(`/api/tasks/${taskId}/attachments/${attachment.id}`, {
                                    method: "DELETE",
                                  });
                                  const data = await res.json().catch(() => ({}));
                                  if (!res.ok) throw new Error((data as any)?.error || "Eliminazione fallita");
                                  setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
                                  toast.success("Allegato eliminato");
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Eliminazione fallita");
                                } finally {
                                  setDeletingAttachmentId(null);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          );
                        })()}
                      </div>
                    ))}

                    <label
                      className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg transition-colors ${
                        canUploadTaskAttachment && !uploading
                          ? "cursor-pointer hover:border-primary/40 hover:bg-muted/20"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">
                        {uploading ? "Caricamento..." : "Trascina file o clicca per caricare"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
                        disabled={uploading || !canUploadTaskAttachment}
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
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">{comment.user.name || comment.user.email}</p>
                              {(() => {
                                const isAuthor = Boolean(meId) && comment.user.id === meId;
                                const canManage = canEditMeta || isAuthor;
                                if (!canManage) return null;
                                return (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      disabled={isSavingCommentEdit}
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentDraft(comment.content);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      disabled={isSavingCommentEdit}
                                      onClick={() => void deleteComment(comment.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                );
                              })()}
                            </div>

                            {editingCommentId === comment.id ? (
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  value={editingCommentDraft}
                                  onChange={(e) => setEditingCommentDraft(e.target.value)}
                                  className="min-h-[90px]"
                                  disabled={isSavingCommentEdit}
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={isSavingCommentEdit}
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentDraft("");
                                    }}
                                  >
                                    Annulla
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isSavingCommentEdit || !editingCommentDraft.trim()}
                                    onClick={() => void saveCommentEdit(comment.id)}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Salva
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{comment.content}</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(comment.createdAt), "PPp", { locale: it })}
                          </p>
                        </div>
                      </div>
                    ))}

                    <Textarea
                      placeholder={canWriteTaskComment ? "Scrivi un commento..." : "Non hai permessi per commentare"}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[90px]"
                      disabled={!canWriteTaskComment}
                    />
                    <Button onClick={addComment} className="w-full" disabled={!canWriteTaskComment || !newComment.trim()}>
                      Aggiungi Commento
                    </Button>
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
        open={subtaskDetailOpen && Boolean(selectedSubtask)}
        onOpenChange={(o) => {
          setSubtaskDetailOpen(o);
          if (!o) setSelectedSubtask(null);
        }}
        overlayClassName="z-[60] bg-black/40"
        contentClassName="z-[60] w-[95vw] sm:max-w-3xl h-full overflow-hidden p-0"
      >
        {selectedSubtask ? (
          <div className="flex h-full flex-col">
            <div className="border-b bg-background p-4 sm:p-6">
              <div className="text-lg font-semibold truncate pr-10">{selectedSubtask.title}</div>
              <div className="text-xs text-muted-foreground mt-1">Subtask</div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-6 space-y-6">
                <div className="space-y-2">
                  <Label>Descrizione</Label>
                  <Textarea
                    value={subtaskDraftDescription}
                    onChange={(e) => setSubtaskDraftDescription(e.target.value)}
                    placeholder="Aggiungi una descrizione..."
                  />
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={saveSubtaskDescription} disabled={!canEditStatus}>
                      Salva descrizione
                    </Button>
                  </div>
                </div>

                <Separator />

                <SubtaskChecklists
                  taskId={taskId}
                  subtaskId={selectedSubtask.id}
                  open={subtaskDetailOpen}
                  disabled={!canEditStatus}
                />

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Allegati</div>
                    <label className="inline-flex items-center gap-2">
                      <Input
                        type="file"
                        disabled={!canEditStatus || subtaskUploading}
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
                      {subtaskAttachments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 border rounded-lg p-2 hover:bg-muted/30"
                        >
                          <a
                            href={a.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1"
                          >
                            <div className="text-sm font-medium truncate">{a.fileName}</div>
                            <div className="text-xs text-muted-foreground">
                              {Math.round(a.fileSize / 1024)} KB
                            </div>
                          </a>
                          {(() => {
                            const isUploader = Boolean(meId) && a.uploadedBy === meId;
                            const canDelete = canEditMeta || isUploader;
                            if (!canDelete) return null;
                            return (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={deletingSubtaskAttachmentId === a.id || subtaskUploading}
                                onClick={async () => {
                                  if (!selectedSubtask) return;
                                  if (!confirm("Eliminare questo allegato?")) return;
                                  setDeletingSubtaskAttachmentId(a.id);
                                  try {
                                    const res = await fetch(
                                      `/api/tasks/${taskId}/subtasks/${selectedSubtask.id}/attachments/${a.id}`,
                                      { method: "DELETE" }
                                    );
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok) throw new Error((data as any)?.error || "Eliminazione fallita");
                                    setSubtaskAttachments((prev) => prev.filter((x) => x.id !== a.id));
                                    toast.success("Allegato eliminato");
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Eliminazione fallita");
                                  } finally {
                                    setDeletingSubtaskAttachmentId(null);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            );
                          })()}
                        </div>
                      ))}
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
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                              {c.user?.name || c.user?.email || "Utente"} · {new Date(c.createdAt).toLocaleString()}
                            </div>
                            {(() => {
                              const isAuthor = Boolean(meId) && c.user?.id === meId;
                              const canManage = canEditMeta || isAuthor;
                              if (!canManage) return null;
                              return (
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={isSavingSubtaskCommentEdit}
                                    onClick={() => {
                                      setEditingSubtaskCommentId(c.id);
                                      setEditingSubtaskCommentDraft(c.content);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    disabled={isSavingSubtaskCommentEdit}
                                    onClick={() => void deleteSubtaskComment(c.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })()}
                          </div>

                          {editingSubtaskCommentId === c.id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editingSubtaskCommentDraft}
                                onChange={(e) => setEditingSubtaskCommentDraft(e.target.value)}
                                className="min-h-[90px]"
                                disabled={isSavingSubtaskCommentEdit}
                              />
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={isSavingSubtaskCommentEdit}
                                  onClick={() => {
                                    setEditingSubtaskCommentId(null);
                                    setEditingSubtaskCommentDraft("");
                                  }}
                                >
                                  Annulla
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isSavingSubtaskCommentEdit || !editingSubtaskCommentDraft.trim()}
                                  onClick={() => void saveSubtaskCommentEdit(c.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Salva
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm mt-1 whitespace-pre-wrap">{c.content}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={subtaskNewComment}
                      onChange={(e) => setSubtaskNewComment(e.target.value)}
                      placeholder="Scrivi un commento…"
                      disabled={!canEditStatus}
                    />
                    <Button onClick={addSubtaskComment} disabled={!canEditStatus || !subtaskNewComment.trim()}>
                      Invia
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        ) : null}
      </SideDrawer>
    </Sheet>
  );
}
