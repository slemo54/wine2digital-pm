"use client";

import { useState, useEffect } from "react";
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
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "react-hot-toast";

interface Subtask {
  id: string;
  title: string;
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

interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  projectId: string;
  onUpdate?: () => void;
}

export function TaskDetailModal({ open, onClose, taskId, projectId, onUpdate }: TaskDetailModalProps) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails();
    }
  }, [open, taskId]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      const [taskRes, subtasksRes, commentsRes, attachmentsRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/subtasks`),
        fetch(`/api/tasks/${taskId}/comments`),
        fetch(`/api/tasks/${taskId}/attachments`),
      ]);

      const [taskData, subtasksData, commentsData, attachmentsData] = await Promise.all([
        taskRes.json(),
        subtasksRes.json(),
        commentsRes.json(),
        attachmentsRes.json(),
      ]);

      setTask(taskData);
      setSubtasks(subtasksData);
      setComments(commentsData);
      setAttachments(attachmentsData);
    } catch (error) {
      console.error("Failed to fetch task details:", error);
      toast.error("Errore durante il caricamento del task");
    } finally {
      setLoading(false);
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

  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const totalSubtasks = subtasks.length;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        </DialogContent>
      </Dialog>
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex h-full">
          {/* Left Panel - Main Content */}
          <div className="flex-1 flex flex-col">
            <DialogHeader className="p-6 border-b">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === "todo" && "Da Fare"}
                      {task.status === "in_progress" && "In Corso"}
                      {task.status === "done" && "Completato"}
                    </Badge>
                    {task.list && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <List className="w-3 h-3" />
                        {task.list}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-2xl font-bold">{task.title}</DialogTitle>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 p-6">
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
                    <div key={subtask.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                      <Checkbox 
                        checked={subtask.completed}
                        onCheckedChange={(checked) => toggleSubtask(subtask.id, !!checked)}
                      />
                      <span className={subtask.completed ? "line-through text-gray-500" : ""}>
                        {subtask.title}
                      </span>
                    </div>
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
                    <div key={attachment.id} className="flex items-center gap-2 p-2 rounded border">
                      <Paperclip className="w-4 h-4 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{attachment.fileName}</p>
                        <p className="text-xs text-gray-500">
                          {(attachment.fileSize / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
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
                <div className="flex gap-1">
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
              </div>

              {/* Due Date */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                  <Calendar className="w-3 h-3" />
                  Scadenza
                </Label>
                {task.dueDate ? (
                  <Badge variant="outline" className="text-sm">
                    {format(new Date(task.dueDate), "PPP", { locale: it })}
                  </Badge>
                ) : (
                  <p className="text-sm text-gray-500">Nessuna scadenza</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-2 block">
                  Priorità
                </Label>
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority === "high" && "Alta"}
                  {task.priority === "medium" && "Media"}
                  {task.priority === "low" && "Bassa"}
                </Badge>
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
      </DialogContent>
    </Dialog>
  );
}
