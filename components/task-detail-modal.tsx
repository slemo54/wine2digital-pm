"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AutosizeTextarea } from "@/components/ui/autosize-textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Check,
  List,
  Pencil,
  Users,
  Calendar,
  Layers,
  Link as LinkIcon
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { SubtasksTab } from "@/components/task-detail/subtasks-tab";
import { DependenciesTab } from "@/components/task-detail/dependencies-tab";

interface Subtask {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
  status: string;
  priority: string;
  dueDate?: string | null;
  position: number;
  assignee?: any;
  dependencies?: any[];
  dependentOn?: any[];
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

  // Edit States
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>([]);
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails();
    }
  }, [open, taskId]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      const [taskRes, subtasksRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/subtasks`),
      ]);

      if (taskRes.ok) {
        setTask(await taskRes.json());
      }
      if (subtasksRes.ok) {
        setSubtasks(await subtasksRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch task details:", error);
      toast.error("Errore caricamento task");
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
      if (!res.ok) throw new Error("Update failed");
      toast.success("Aggiornato");
      fetchTaskDetails();
      onUpdate?.();
    } catch (e) {
      toast.error("Errore aggiornamento");
    } finally {
      setIsSavingMeta(false);
    }
  };

  if (!task) return null;

  const projectMembers = task?.project?.members || [];
  const memberUsers = projectMembers.map((m: any) => m.user || m).filter(Boolean);
  const currentAssigneeIds = task.assignees?.map((a: any) => a.userId) || [];

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
      <SheetContent side="right" className="w-[95vw] sm:max-w-4xl h-full p-0 flex flex-col bg-background">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className={getStatusColor(task.status)}>
              {task.status === "todo" && "Da Fare"}
              {task.status === "in_progress" && "In Corso"}
              {task.status === "done" && "Completato"}
            </Badge>
            <Badge variant="outline">{task.priority}</Badge>
          </div>

          {isEditingTitle ? (
            <div className="flex gap-2">
              <Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} />
              <Button onClick={() => updateTaskMeta({ title: draftTitle }).then(() => setIsEditingTitle(false))}>Salva</Button>
              <Button variant="ghost" onClick={() => setIsEditingTitle(false)}>Annulla</Button>
            </div>
          ) : (
            <h2 className="text-2xl font-bold flex items-center gap-2 group">
              {task.title}
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => { setDraftTitle(task.title); setIsEditingTitle(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
            </h2>
          )}
        </div>

        {/* Tabs Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <div className="px-6 border-b bg-muted/10">
              <TabsList className="bg-transparent h-12 w-full justify-start gap-4 p-0">
                <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="subtasks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">
                  <Layers className="w-4 h-4 mr-2" /> Subtasks
                </TabsTrigger>
                <TabsTrigger value="dependencies" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">
                  <LinkIcon className="w-4 h-4 mr-2" /> Blockers
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">
                  Activity
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <TabsContent value="overview" className="m-0 space-y-6">
                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-muted-foreground">Description</h3>
                    {!isEditingDescription && (
                      <Button variant="ghost" size="sm" onClick={() => { setDraftDescription(task.description || ""); setIsEditingDescription(true); }}>
                        Edit
                      </Button>
                    )}
                  </div>
                  {isEditingDescription ? (
                    <div className="space-y-2">
                      <AutosizeTextarea
                        value={draftDescription}
                        onChange={e => setDraftDescription(e.target.value)}
                        minHeight={100}
                        className="resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingDescription(false)}>Cancel</Button>
                        <Button size="sm" onClick={() => updateTaskMeta({ description: draftDescription }).then(() => setIsEditingDescription(false))}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{task.description || "No description provided."}</div>
                  )}
                </div>

                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-xs text-muted-foreground mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Assignees</h3>
                    <div className="flex flex-wrap gap-1">
                      {task.assignees?.map((a: any) => (
                        <Avatar key={a.userId} className="w-6 h-6">
                          <AvatarImage src={a.user?.image} />
                          <AvatarFallback>{a.user?.firstName?.[0] || "U"}</AvatarFallback>
                        </Avatar>
                      ))}
                      <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 text-xs">+ Add</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-2" align="start">
                          <div className="space-y-1">
                            {memberUsers.map((u: any) => (
                              <div key={u.id} className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer"
                                onClick={() => {
                                  const newIds = currentAssigneeIds.includes(u.id)
                                    ? currentAssigneeIds.filter((id: string) => id !== u.id)
                                    : [...currentAssigneeIds, u.id];
                                  updateTaskMeta({ assigneeIds: newIds });
                                }}>
                                <Checkbox checked={currentAssigneeIds.includes(u.id)} />
                                <span className="text-sm truncate">{u.name || u.email}</span>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-xs text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due Date</h3>
                    <div className="text-sm">
                      {task.dueDate ? format(new Date(task.dueDate), "PPP", { locale: it }) : "None"}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="subtasks" className="m-0">
                <SubtasksTab
                  taskId={taskId}
                  subtasks={subtasks}
                  projectMembers={memberUsers}
                  canEdit={true}
                  onUpdate={fetchTaskDetails}
                />
              </TabsContent>

              <TabsContent value="dependencies" className="m-0">
                <DependenciesTab
                  taskId={taskId}
                  taskTitle={task.title}
                  subtasks={subtasks}
                  onUpdate={fetchTaskDetails}
                />
              </TabsContent>

              <TabsContent value="activity" className="m-0">
                <div className="text-center text-muted-foreground py-8">
                  Activity log coming soon...
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
