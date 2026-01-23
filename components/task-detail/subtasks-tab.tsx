"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar, Trash2, User, AlertCircle, Plus, ChevronDown, ChevronUp, Loader2, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { AutosizeTextarea } from "@/components/ui/autosize-textarea";
import { SubtaskChecklists } from "@/components/subtask-checklists";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Subtask {
    id: string;
    title: string;
    description?: string | null;
    completed: boolean; // Deprecated
    status: string;
    priority: string; // low, medium, high
    dueDate?: string | null;
    position: number;
    assignee?: {
        id: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        image?: string | null;
    } | null;
}

interface SubtasksTabProps {
    taskId: string;
    subtasks: Subtask[];
    projectMembers: any[];
    onUpdate: () => void;
    canEdit: boolean;
}

function SortableSubtask({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
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
        <div ref={setNodeRef} style={style} className="flex gap-2 group/sortable">
            {!disabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className="mt-3 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover/sortable:opacity-100 transition-opacity"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            )}
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

export function SubtasksTab({ taskId, subtasks, projectMembers, onUpdate, canEdit }: SubtasksTabProps) {
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks);

    useEffect(() => {
        const savedOrder = localStorage.getItem(`task_subtask_order_${taskId}`);
        if (savedOrder) {
            try {
                const orderMap = JSON.parse(savedOrder);
                const sorted = [...subtasks].sort((a, b) => {
                    const posA = orderMap[a.id] ?? a.position ?? 0;
                    const posB = orderMap[b.id] ?? b.position ?? 0;
                    return posA - posB;
                });
                setLocalSubtasks(sorted);
            } catch {
                setLocalSubtasks(subtasks);
            }
        } else {
            setLocalSubtasks(subtasks);
        }
    }, [subtasks, taskId]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setLocalSubtasks((items) => {
            const oldIndex = items.findIndex((s) => s.id === active.id);
            const newIndex = items.findIndex((s) => s.id === over.id);
            const newItems = arrayMove(items, oldIndex, newIndex);

            const orderMap = newItems.reduce((acc, item, index) => ({ ...acc, [item.id]: index }), {});
            localStorage.setItem(`task_subtask_order_${taskId}`, JSON.stringify(orderMap));

            return newItems;
        });
    };

    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim()) return;
        setIsAdding(true);
        try {
            const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newSubtaskTitle }),
            });
            if (res.ok) {
                setNewSubtaskTitle("");
                onUpdate();
                toast.success("Subtask aggiunto");
            }
        } catch (e) {
            toast.error("Errore aggiunta subtask");
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggleStatus = async (subtaskId: string, currentStatus: string) => {
        const newStatus = currentStatus === "done" ? "todo" : "done";
        try {
            const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                // Send both for compatibility
                body: JSON.stringify({ status: newStatus, completed: newStatus === "done" }),
            });
            if (!res.ok) {
                const data = await res.json();
                if (res.status === 409) {
                    toast.error(data.error || "Blocked by dependencies!");
                    return;
                }
                throw new Error("Update failed");
            }
            onUpdate();
        } catch (e) {
            toast.error("Errore aggiornamento stato");
        }
    };

    const handleDelete = async (subtaskId: string) => {
        if (!confirm("Eliminare subtask?")) return;
        try {
            await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
            onUpdate();
            toast.success("Eliminato");
        } catch (e) {
            toast.error("Errore eliminazione");
        }
    };

    const getPriorityColor = (p: string) => {
        if (p === 'high') return 'text-red-500 bg-red-100';
        if (p === 'medium') return 'text-orange-500 bg-orange-100';
        return 'text-green-500 bg-green-100';
    };

    const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedSubtasks);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedSubtasks(newSet);
    };

    return (
        <div className="space-y-4 pt-4">
            <div className="flex gap-2 items-start">
                <AutosizeTextarea
                    placeholder="Nuovo subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddSubtask()}
                    disabled={!canEdit || isAdding}
                    className="flex-1"
                />
                <Button onClick={handleAddSubtask} disabled={!canEdit || isAdding}>
                    {isAdding ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Aggiungi
                </Button>
            </div>

            <div className="space-y-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localSubtasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        {localSubtasks.map((st) => (
                            <SortableSubtask key={st.id} id={st.id} disabled={!canEdit}>
                                <div className="border rounded-lg bg-card hover:bg-accent/50 transition-colors group">
                                    <div className="flex items-start justify-between p-3">
                                        <div className="flex items-start gap-3 flex-1">
                                            <Checkbox
                                                checked={st.status === 'done' || st.completed}
                                                onCheckedChange={() => handleToggleStatus(st.id, st.status)}
                                                disabled={!canEdit}
                                                className="mt-1"
                                            />
                                            <div className="flex flex-col flex-1 gap-1">
                                                <div className="flex items-center gap-2 w-full">
                                                    <AutosizeTextarea
                                                        value={st.title}
                                                        onChange={() => { }}
                                                        className="min-h-[24px] py-1 px-0 border-none shadow-none focus-visible:ring-0 bg-transparent resize-none overflow-hidden text-sm font-medium"
                                                        readOnly={!canEdit}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 hover:bg-muted"
                                                        onClick={() => toggleExpand(st.id)}
                                                    >
                                                        {expandedSubtasks.has(st.id) ? (
                                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    {st.dueDate && (
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(new Date(st.dueDate), "d MMM", { locale: it })}
                                                        </span>
                                                    )}
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${getPriorityColor(st.priority)}`}>
                                                        {st.priority}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {st.assignee ? (
                                                <Avatar className="w-6 h-6" title={st.assignee.name || st.assignee.email || ""}>
                                                    <AvatarImage src={st.assignee.image || undefined} />
                                                    <AvatarFallback>{(st.assignee.firstName?.[0] || "U")}</AvatarFallback>
                                                </Avatar>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full border border-dashed flex items-center justify-center text-muted-foreground">
                                                    <User className="w-3 h-3" />
                                                </div>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(st.id)}
                                                disabled={!canEdit}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {expandedSubtasks.has(st.id) && (
                                        <div className="px-3 pb-3 pt-0 border-t border-dashed mt-2">
                                            <SubtaskChecklists
                                                taskId={taskId}
                                                subtaskId={st.id}
                                                open={expandedSubtasks.has(st.id)}
                                                disabled={!canEdit}
                                            />
                                        </div>
                                    )}
                                </div>
                            </SortableSubtask>
                        ))}
                    </SortableContext>
                </DndContext>
                {localSubtasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                        Nessun subtask. Aggiungine uno sopra.
                    </div>
                )}
            </div>
        </div>
    );
}
