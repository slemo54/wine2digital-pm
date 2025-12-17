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
  createdAt: string;
}

interface SubtaskAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  createdAt: string;
}

interface SubtaskComment {
  id: string;
  content: string;
  user: {
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
  const [activeTab, setActiveTab] = useState<"activity" | "my_work" | "assigned" | "comments">("activity");
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [projectLists, setProjectLists] = useState<Array<{ id: string; name: string }>>([]);
  const [subtaskDetailOpen, setSubtaskDetailOpen] = useState(false);
  const [selectedSubtask, setSelectedSubtask] = useState<Subtask | null>(null);
  const [subtaskAttachments, setSubtaskAttachments] = useState<SubtaskAttachment[]>([]);
  const [subtaskComments, setSubtaskComments] = useState<SubtaskComment[]>([]);
  const [subtaskUploading, setSubtaskUploading] = useState(false);
  const [subtaskDraftDescription, setSubtaskDraftDescription] = useState("");
  const [subtaskNewComment, setSubtaskNewComment] = useState("");

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails();
    }
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

  const canEditMeta = (() => {
    const role = (session?.user as any)?.role as string | undefined;
    return role === "admin" || role === "manager";
  })();

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
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        setNewComment("");
        toast.success("Commento aggiunto");
      }
    } catch (error) {
      toast.error("Errore durante l'aggiunta del commento");
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
  }, [taskId, task?.updatedAt, currentAssigneeKey, task]);

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
      <SheetContent side="right" className="w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex h-full">
          {/* Left Panel - Main Content */}
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
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
                  </div>
                  <div className="text-2xl font-bold pr-10">{task.title}</div>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="my_work">My Work</TabsTrigger>
                    <TabsTrigger value="assigned">Assigned</TabsTrigger>
                    <TabsTrigger value="comments">Comments</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              {activeTab === "activity" || activeTab === "my_work" ? (
                <div className="space-y-3">
                  {(activeTab === "my_work"
                    ? activityEvents.filter((e) => e?.actor?.id && e.actor.id === (session?.user as any)?.id)
                    : activityEvents
                  ).map((e) => (
                    <div key={e.id} className="flex gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={e.actor?.image || undefined} />
                        <AvatarFallback>
                          {(e.actor?.name?.[0] || e.actor?.email?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm font-medium">
                            {e.actor?.name || e.actor?.email || "Sistema"}
                          </p>
                          <p className="text-sm text-gray-700 mt-1">
                            {formatTaskActivityEvent(e, userNameById).message}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(e.createdAt), "PPp", { locale: it })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(activeTab === "my_work"
                    ? activityEvents.filter((e) => e?.actor?.id && e.actor.id === (session?.user as any)?.id)
                    : activityEvents
                  ).length === 0 ? (
                    <p className="text-sm text-gray-500">Nessuna attività.</p>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "assigned" ? (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" />
                    Assegnatari
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {task.assignees?.map((assignee: any) => (
                      <div key={assignee.user.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={assignee.user.image || undefined} />
                          <AvatarFallback>
                            {assignee.user.name?.[0] || assignee.user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {assignee.user.name || `${assignee.user.firstName || ""} ${assignee.user.lastName || ""}`.trim() || assignee.user.email}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{assignee.user.email}</p>
                        </div>
                      </div>
                    ))}
                    {(!task.assignees || task.assignees.length === 0) ? (
                      <p className="text-sm text-gray-500">Nessun assegnatario</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "comments" ? (
                <>
                  {/* Subtasks Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Subtasks
                        <span className="text-gray-500">
                          {completedSubtasks} / {totalSubtasks}
                        </span>
                      </h3>
                      {totalSubtasks > 0 && (
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {subtasks.map((subtask) => (
                        <button
                          key={subtask.id}
                          type="button"
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-gray-50"
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
                          <span className={subtask.completed ? "line-through text-gray-500" : ""}>
                            {subtask.title}
                          </span>
                        </button>
                      ))}

                      <div className="flex items-center gap-2 mt-2">
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
                  </div>

                  <Separator className="my-6" />

                  {/* Attachments Section */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Paperclip className="w-4 h-4" />
                      Allegati
                      <span className="text-gray-500">({attachments.length})</span>
                    </h3>

                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50 transition-colors"
                        >
                          <Paperclip className="w-4 h-4 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {(attachment.fileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </a>
                      ))}

                      <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors">
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

                  <Separator className="my-6" />

                  {/* Comments Section */}
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4" />
                      Commenti
                      <span className="text-gray-500">({comments.length})</span>
                    </h3>

                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={comment.user.image || undefined} />
                            <AvatarFallback>
                              {comment.user.name?.[0] || comment.user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-sm font-medium">
                                {comment.user.name || comment.user.email}
                              </p>
                              <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(comment.createdAt), "PPp", { locale: it })}
                            </p>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2 mt-4">
                        <Textarea
                          placeholder="Scrivi un commento..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="flex-1 min-h-[80px]"
                        />
                      </div>
                      <Button onClick={addComment} className="w-full">
                        Aggiungi Commento
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </ScrollArea>
          </div>

          {/* Right Sidebar - Task Details */}
          <div className="w-80 border-l bg-gray-50 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Assignees */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                  <Users className="w-3 h-3" />
                  Assegnatari
                </Label>
                <div className="flex gap-1 flex-wrap">
                  {task.assignees?.map((assignee: any) => (
                    <Avatar key={assignee.user.id} className="w-8 h-8">
                      <AvatarImage src={assignee.user.image || undefined} />
                      <AvatarFallback>
                        {assignee.user.name?.[0] || assignee.user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {(!task.assignees || task.assignees.length === 0) && (
                    <p className="text-sm text-gray-500">Nessun assegnatario</p>
                  )}
                </div>

                {canEditMeta ? (
                  <div className="mt-3">
                    <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isSavingMeta}>
                          Modifica assegnatari
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="text-sm font-medium mb-2">Seleziona assegnatari</div>
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
                            <p className="text-sm text-gray-500">Nessun membro progetto disponibile</p>
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
                            onClick={() => updateTaskMeta({ assigneeIds: draftAssigneeIds }).then(() => setAssigneePickerOpen(false))}
                          >
                            Salva
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : null}
              </div>

              {/* Category */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                  <List className="w-3 h-3" />
                  Categoria
                </Label>
                <div className="space-y-2">
                  {task.taskList?.name || task.list ? (
                    <Badge variant="outline" className="text-sm">
                      {task.taskList?.name || task.list}
                    </Badge>
                  ) : (
                    <p className="text-sm text-gray-500">Nessuna categoria</p>
                  )}

                  {canEditMeta ? (
                    <Select
                      value={task.listId || ""}
                      onValueChange={(v) => updateTaskMeta({ listId: v || null })}
                      disabled={isSavingMeta || projectLists.length === 0}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={projectLists.length === 0 ? "Categorie non disponibili" : "Seleziona"} />
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

              {/* Due Date */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                  <Calendar className="w-3 h-3" />
                  Scadenza
                </Label>
                <div className="space-y-2">
                  {task.dueDate ? (
                    <Badge variant="outline" className="text-sm">
                      {format(new Date(task.dueDate), "PPP", { locale: it })}
                    </Badge>
                  ) : (
                    <p className="text-sm text-gray-500">Nessuna scadenza</p>
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
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-2 block">
                  Priorità
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

              {/* Story Points */}
              {task.storyPoints !== null && (
                <div>
                  <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                    <Hash className="w-3 h-3" />
                    Story Points
                  </Label>
                  <Badge variant="outline">{task.storyPoints}</Badge>
                </div>
              )}

              {/* Tags */}
              {task.tags && (
                <div>
                  <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                    <Tag className="w-3 h-3" />
                    Tags
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(task.tags).map((tag: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Created At */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                  <Clock className="w-3 h-3" />
                  Creato
                </Label>
                <p className="text-sm text-gray-700">
                  {format(new Date(task.createdAt), "PPP", { locale: it })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>

      <Dialog open={subtaskDetailOpen} onOpenChange={setSubtaskDetailOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Subtask</DialogTitle>
          </DialogHeader>

          {selectedSubtask ? (
            <div className="space-y-4">
              <div className="text-lg font-semibold">{selectedSubtask.title}</div>

              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea
                  value={subtaskDraftDescription}
                  onChange={(e) => setSubtaskDraftDescription(e.target.value)}
                  placeholder="Aggiungi una descrizione..."
                />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={saveSubtaskDescription}>
                    Salva descrizione
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Allegati</div>
                  <label className="inline-flex items-center gap-2">
                    <Input
                      type="file"
                      disabled={subtaskUploading}
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
                      <a
                        key={a.id}
                        href={a.filePath}
                        target="_blank"
                        rel="noreferrer"
                        className="block border rounded-lg p-2 hover:bg-muted/30"
                      >
                        <div className="text-sm font-medium">{a.fileName}</div>
                        <div className="text-xs text-muted-foreground">{Math.round(a.fileSize / 1024)} KB</div>
                      </a>
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
                        <div className="text-xs text-muted-foreground">
                          {c.user?.name || c.user?.email || "Utente"} · {new Date(c.createdAt).toLocaleString()}
                        </div>
                        <div className="text-sm mt-1 whitespace-pre-wrap">{c.content}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={subtaskNewComment}
                    onChange={(e) => setSubtaskNewComment(e.target.value)}
                    placeholder="Scrivi un commento…"
                  />
                  <Button onClick={addSubtaskComment} disabled={!subtaskNewComment.trim()}>
                    Invia
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
