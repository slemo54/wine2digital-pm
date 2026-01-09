"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar, Trash2, User, AlertCircle, Plus, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { AutosizeTextarea } from "@/components/ui/autosize-textarea";
import { SubtaskChecklists } from "@/components/subtask-checklists";

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

export function SubtasksTab({ taskId, subtasks, projectMembers, onUpdate, canEdit }: SubtasksTabProps) {
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [isAdding, setIsAdding] = useState(false);

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
                {subtasks.map((st) => (
                    <div key={st.id} className="border rounded-lg bg-card hover:bg-accent/50 transition-colors group">
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
                                    <div className="w-6 h-6 rounded-full border border-dashed flex items-center justify-center">
                                        <User className="w-3 h-3 text-muted-foreground" />
                                    </div>
                                )}

                                {canEdit && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(st.id)}>
                                        <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Enhanced Content (Checklists) */}
                        {expandedSubtasks.has(st.id) && (
                            <div className="px-3 pb-3 pt-0 pl-11">
                                <SubtaskChecklists
                                    taskId={taskId}
                                    subtaskId={st.id}
                                    open={true}
                                />
                            </div>
                        )}
                    </div>
                ))}

                {subtasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        Nessun subtask. Aggiungine uno per iniziare.
                    </div>
                )}
            </div>
        </div >
    );
}
