"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./task-card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ListTodo, Plus } from "lucide-react";
import { useState } from "react";
import { CreateTaskDialog } from "../create-task-dialog";
import { getKanbanEmptyState } from "./kanban-empty-state";
import { getClientLocale, t } from "@/lib/i18n";

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
  const locale = getClientLocale();

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
          {tasks?.length ? (
            tasks.map((task) => <TaskCard key={task?.id} task={task} projectId={projectId} />)
          ) : (
            (() => {
              const empty = getKanbanEmptyState(id);
              if (!empty) return null;
              const Icon =
                empty.icon === "todo" ? ListTodo : empty.icon === "in_progress" ? Loader2 : CheckCircle2;
              return (
                <div className="flex flex-col items-center justify-center text-center border border-dashed rounded-xl bg-white/60 px-6 py-10">
                  <Icon className={`h-8 w-8 text-muted-foreground ${empty.icon === "in_progress" ? "animate-spin" : ""}`} />
                  <div className="mt-3 font-semibold text-sm">{t(locale, empty.titleKey)}</div>
                  <div className="mt-1 text-xs text-muted-foreground max-w-[240px]">
                    {t(locale, empty.bodyKey)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t(locale, empty.ctaKey)}
                  </Button>
                </div>
              );
            })()
          )}
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
