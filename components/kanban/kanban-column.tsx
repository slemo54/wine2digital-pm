"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./task-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateTaskDialog } from "../create-task-dialog";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignees?: any[];
}

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  projectId: string;
  members: any[];
  onTaskUpdate: () => void;
}

export function KanbanColumn({ id, title, color, tasks, projectId, members, onTaskUpdate }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const getStatusColor = () => {
    switch (id) {
      case "todo":
        return "bg-gray-400";
      case "in_progress":
        return "bg-destructive";
      case "done":
        return "bg-success";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl bg-secondary p-4 min-h-[600px] transition-all ${
        isOver ? "ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <span className="text-sm text-muted-foreground bg-white rounded-full px-2.5 py-0.5 border">
            {tasks?.length || 0}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 hover:bg-white"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={tasks?.map(t => t?.id) || []} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3">
          {tasks?.map((task) => (
            <TaskCard key={task?.id} task={task} projectId={projectId} />
          ))}
        </div>
      </SortableContext>

      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          onTaskUpdate();
          setShowCreateDialog(false);
        }}
        projectId={projectId}
        defaultStatus={id}
        members={members}
      />
    </div>
  );
}
