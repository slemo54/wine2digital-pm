"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Trash2, Settings2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CustomField {
    id: string;
    name: string;
    type: string;
    description?: string;
}

export function CustomFieldDefinitionsManager({ projectId }: { projectId: string }) {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newField, setNewField] = useState({ name: "", type: "text" });

    const fetchFields = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/custom-fields`);
            const data = await res.json();
            setFields(data.customFields || []);
        } catch (e) {
            toast.error("Errore caricamento campi");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) fetchFields();
    }, [projectId]);

    const addField = async () => {
        if (!newField.name.trim()) return;
        setIsCreating(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/custom-fields`, {
                method: "POST",
                body: JSON.stringify(newField),
            });
            if (!res.ok) throw new Error("Errore creazione");
            toast.success("Campo aggiunto");
            setNewField({ name: "", type: "text" });
            fetchFields();
        } catch (e) {
            toast.error("Errore creazione");
        } finally {
            setIsCreating(false);
        }
    };

    const deleteField = async (id: string) => {
        if (!confirm("Sei sicuro? I valori inseriti per questo campo in tutte le task verranno eliminati.")) return;
        try {
            const res = await fetch(`/api/projects/${projectId}/custom-fields/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Errore eliminazione");
            toast.success("Campo eliminato");
            fetchFields();
        } catch (e) {
            toast.error("Errore eliminazione");
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Settings2 className="w-6 h-6 text-primary" />
                    Configurazione Campi Personalizzati
                </h3>
                <p className="text-muted-foreground">
                    Definisci i campi aggiuntivi disponibili per tutte le task di questo progetto.
                </p>
            </div>

            <div className="grid gap-6">
                {/* Creation Card */}
                <div className="rounded-xl border border-border/50 bg-card/50 shadow-sm p-6 backdrop-blur-sm transition-all hover:bg-card/80 hover:shadow-md hover:border-border/80">
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="space-y-2 flex-1 w-full">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome Campo</Label>
                            <Input
                                value={newField.name}
                                onChange={e => setNewField(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Es. Codice Fiscale, Budget, Link Esterno..."
                                className="bg-background/50 border-border/50 h-10 transition-colors focus:bg-background"
                            />
                        </div>
                        <div className="space-y-2 w-full sm:w-48">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
                            <Select
                                value={newField.type}
                                onValueChange={v => setNewField(prev => ({ ...prev, type: v }))}
                            >
                                <SelectTrigger className="bg-background/50 border-border/50 h-10 transition-colors focus:bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Testo</SelectItem>
                                    <SelectItem value="number">Numero</SelectItem>
                                    <SelectItem value="date">Data</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={addField}
                            disabled={isCreating || !newField.name.trim()}
                            className="h-10 px-6 font-medium shadow-sm active:scale-95 transition-all"
                        >
                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                            {isCreating ? "Aggiunta..." : "Aggiungi Campo"}
                        </Button>
                    </div>
                </div>

                {/* Fields List */}
                <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="w-[40%]">Nome Campo</TableHead>
                                <TableHead className="w-[30%]">Tipo</TableHead>
                                <TableHead className="w-[30%] text-right">Azioni</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                            <span className="text-sm">Caricamento configurazione...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : fields.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-48 text-center bg-muted/5">
                                        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground/60 w-full">
                                            <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                                                <Settings2 className="w-6 h-6" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-medium text-foreground">Nessun campo personalizzato</p>
                                                <p className="text-sm mt-1">Aggiungi il tuo primo campo usando il form sopra.</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                fields.map(f => (
                                    <TableRow key={f.id} className="group transition-colors hover:bg-muted/50 border-border/50">
                                        <TableCell className="font-medium text-foreground py-4">
                                            {f.name}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                                                {f.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                                onClick={() => deleteField(f.id)}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Elimina
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
