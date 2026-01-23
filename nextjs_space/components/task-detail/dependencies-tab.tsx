"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Ban, Link as LinkIcon, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface SimplifiedTask {
    id: string;
    title: string;
    status: string;
}

interface SimplifiedSubtask {
    id: string;
    title: string;
    status: string;
    dependencies?: any[]; // what this subtask depends on
}

interface DependenciesTabProps {
    taskId: string;
    taskTitle: string;
    // For MVP, simplistic view. 
    // In reality, we might need a separate fetch for potential dependencies to add.
    subtasks: SimplifiedSubtask[];
    onUpdate: () => void;
}

export function DependenciesTab({ taskId, taskTitle, subtasks, onUpdate }: DependenciesTabProps) {
    // This component currently focuses on Subtask Dependencies visualization as per V2 plan.
    // We can expand to Task Dependencies later if needed.

    const [selectedSubtask, setSelectedSubtask] = useState<string>("");
    const [selectedDependency, setSelectedDependency] = useState<string>("");
    const [isAdding, setIsAdding] = useState(false);

    // Group dependencies for visualization
    // List of Subtasks that are BLOCKED (have dependencies)
    const blockedSubtasks = subtasks.filter(s => s.dependencies && s.dependencies.length > 0);

    const handleAddDependency = async () => {
        if (!selectedSubtask || !selectedDependency || selectedSubtask === selectedDependency) return;
        setIsAdding(true);
        try {
            const res = await fetch(`/api/subtasks/${selectedSubtask}/dependencies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dependsOnId: selectedDependency })
            });
            if (res.ok) {
                toast.success("Dipendenza aggiunta");
                onUpdate();
                setSelectedSubtask("");
                setSelectedDependency("");
            } else {
                const data = await res.json();
                toast.error(data.error || "Errore");
            }
        } catch (e) {
            toast.error("Errore di connessione");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteDependency = async (depId: string) => {
        if (!confirm("Rimuovere dipendenza?")) return;
        try {
            await fetch(`/api/subtasks/dependencies/${depId}`, { method: "DELETE" });
            onUpdate();
            toast.success("Rimossa");
        } catch (e) {
            toast.error("Errore eliminazione");
        }
    };

    return (
        <div className="space-y-6 pt-4">
            <div className="p-4 border rounded-lg bg-muted/20">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" /> Aggiungi Blocco
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full space-y-1">
                        <Label className="text-xs">Subtask che viene bloccato</Label>
                        <Select value={selectedSubtask} onValueChange={setSelectedSubtask}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona subtask..." />
                            </SelectTrigger>
                            <SelectContent>
                                {subtasks.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="pb-3 text-muted-foreground"><ArrowRight className="w-4 h-4" /></div>

                    <div className="flex-1 w-full space-y-1">
                        <Label className="text-xs">Dipende da (deve finire prima)</Label>
                        <Select value={selectedDependency} onValueChange={setSelectedDependency}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona bloccante..." />
                            </SelectTrigger>
                            <SelectContent>
                                {subtasks.filter(s => s.id !== selectedSubtask).map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={handleAddDependency} disabled={!selectedSubtask || !selectedDependency || isAdding}>
                        Aggiungi
                    </Button>
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-3">Dipendenze Attive</h3>
                {blockedSubtasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nessuna dipendenza definita.</p>
                ) : (
                    <div className="space-y-3">
                        {blockedSubtasks.map(bs => (
                            <div key={bs.id} className="border rounded-md p-3">
                                <div className="font-medium flex items-center gap-2 mb-2">
                                    <Ban className="w-4 h-4 text-red-500" />
                                    {bs.title}
                                    <Badge variant="outline" className="text-[10px]">BLOCKED</Badge>
                                </div>
                                <div className="pl-6 space-y-1">
                                    <p className="text-xs text-muted-foreground mb-1">In attesa di:</p>
                                    {bs.dependencies?.map((dep: any) => (
                                        <div key={dep.id} className="flex items-center justify-between bg-background border p-2 rounded text-sm">
                                            <span className={dep.dependsOn?.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                                                {dep.dependsOn?.title || "Unknown Subtask"}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {dep.dependsOn?.status === 'done' ? (
                                                    <Badge variant="success" className="text-[10px] bg-green-100 text-green-700">DONE</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px]">PENDING</Badge>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteDependency(dep.id)}>
                                                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
