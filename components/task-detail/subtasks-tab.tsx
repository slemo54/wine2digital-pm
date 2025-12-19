"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar, Trash2, User, AlertCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "react-hot-toast";

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

    return (
        <div className="space-y-4 pt-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Nuovo subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    disabled={!canEdit || isAdding}
                />
                <Button onClick={handleAddSubtask} disabled={!canEdit || isAdding}>
                    <Plus className="w-4 h-4 mr-1" /> Aggiungi
                </Button>
            </div>

            <div className="space-y-2">
                {subtasks.map((st) => (
                    <div key={st.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors group">
                        <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                                checked={st.status === 'done' || st.completed}
                                onCheckedChange={() => handleToggleStatus(st.id, st.status)}
                                disabled={!canEdit}
                            />
                            <div className="flex flex-col">
                                <span className={`text-sm font-medium ${st.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                                    {st.title}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
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
                ))}

                {subtasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        Nessun subtask. Aggiungine uno per iniziare.
                    </div>
                )}
            </div>
        </div>
    );
}
