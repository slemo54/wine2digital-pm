"use client";

import { useState, useEffect } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
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

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: () => void;
  projectId: string;
  members: any[];
}

const columns = [
  { id: "todo", title: "To Do", color: "bg-gray-100" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-100" },
  { id: "done", title: "Done", color: "bg-green-100" },
];

export function KanbanBoard({ tasks, onTaskUpdate, projectId, members }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Update local tasks when props change
  useEffect(() => {
    if (!isUpdating) {
      setLocalTasks(tasks);
    }
  }, [tasks, isUpdating]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event?.active?.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !active) {
      setActiveId(null);
      return;
    }

    const taskId = active.id as string;
    const newStatus = over.id as string;

    // Find the task being moved
    const task = localTasks?.find(t => t?.id === taskId);
    
    if (!task || task.status === newStatus || isUpdating) {
      setActiveId(null);
      return;
    }

    // Optimistic update - update local state immediately
    const previousTasks = [...localTasks];
    const updatedLocalTasks = localTasks.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    setLocalTasks(updatedLocalTasks);
    setActiveId(null);

    // Update server
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      toast.success("Task moved successfully");
      
      // Wait a bit before refreshing to avoid race conditions
      setTimeout(() => {
        onTaskUpdate();
        setIsUpdating(false);
      }, 300);
    } catch (error) {
      // Revert optimistic update on error
      setLocalTasks(previousTasks);
      toast.error("Failed to move task");
      setIsUpdating(false);
    }
  };

  const getTasksByStatus = (status: string) => {
    return localTasks?.filter(task => task?.status === status) || [];
  };

  const activeTask = localTasks?.find(t => t?.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns?.map((column) => (
          <KanbanColumn
            key={column?.id}
            id={column?.id}
            title={column?.title}
            color={column?.color}
            tasks={getTasksByStatus(column?.id || "")}
            projectId={projectId}
            members={members}
            onTaskUpdate={onTaskUpdate}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="opacity-50">
            <TaskCard task={activeTask} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
