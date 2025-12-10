"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, AlertCircle, Clock, MoreVertical, MessageCircle, Paperclip } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { EditTaskDialog } from "../edit-task-dialog";
import { TaskDetailModal } from "../task-detail-modal";
import { toast } from "react-hot-toast";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignees?: any[];
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  projectId?: string;
}

export function TaskCard({ task, isDragging, projectId }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task?.id });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      case "low":
        return "success";
      default:
        return "secondary";
    }
  };

  const getPriorityBgColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive";
      case "medium":
        return "bg-warning/10 text-warning border-warning";
      case "low":
        return "bg-success/10 text-success border-success";
      default:
        return "";
    }
  };

  // Random progress for demo (in real app, calculate from subtasks)
  const getProgress = () => {
    if (task?.status === "done") return 100;
    if (task?.status === "in_progress") return Math.floor(Math.random() * 70) + 20;
    return 0;
  };

  const progress = getProgress();

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names?.map(n => n?.[0] || "").join("").toUpperCase().slice(0, 2) || "U";
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${task?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }

      toast.success("Task deleted successfully");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing hover:shadow-lg transition-all bg-white border-l-4 border-l-transparent hover:border-l-primary"
      >
        <CardContent 
          className="p-4 space-y-3"
          onClick={(e) => {
            // Don't open modal if clicking on dropdown or dragging
            if (e.defaultPrevented || isDragging || isSortableDragging) return;
            setShowDetailModal(true);
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Badge variant="outline" className={`text-xs mb-2 ${getPriorityBgColor(task?.priority)}`}>
                <AlertCircle className="h-3 w-3 mr-1" />
                {task?.priority || "medium"}
              </Badge>
              <h4 className="font-semibold text-sm leading-tight text-foreground">{task?.title || "Untitled"}</h4>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {task?.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}

          {/* Progress Bar */}
          {progress > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress 
                value={progress} 
                className={`h-1.5 ${
                  task?.status === "done" ? "bg-success/20" : 
                  task?.status === "in_progress" ? "bg-info/20" : "bg-gray-200"
                }`}
              />
            </div>
          )}

          {task?.dueDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1">
              {task?.assignees && task.assignees.length > 0 && (
                <>
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <Avatar key={assignee?.user?.id} className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-accent text-foreground">
                        {getInitials(`${assignee?.user?.firstName || ""} ${assignee?.user?.lastName || ""}`)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {(task?.assignees?.length || 0) > 3 && (
                    <span className="text-xs text-muted-foreground ml-1">+{task.assignees.length - 3}</span>
                  )}
                </>
              )}
            </div>
            
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="flex items-center gap-1 text-xs">
                <Paperclip className="h-3 w-3" />
                <span>3</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <MessageCircle className="h-3 w-3" />
                <span>7</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditTaskDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSuccess={() => {
          setShowEditDialog(false);
          window.location.reload();
        }}
        task={task}
      />

      {projectId && (
        <TaskDetailModal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          taskId={task.id}
          projectId={projectId}
          onUpdate={() => window.location.reload()}
        />
      )}
    </>
  );
}
