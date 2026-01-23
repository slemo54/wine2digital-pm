"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CSVImportWizardProps {
    open: boolean;
    onClose: () => void;
    projectId: string;
    onSuccess: () => void;
}

const SYSTEM_FIELDS = [
    { id: "skip", name: "Salta colonna" },
    { id: "title", name: "Titolo Task" },
    { id: "description", name: "Descrizione" },
    { id: "status", name: "Stato" },
    { id: "priority", name: "Priorità" },
    { id: "dueDate", name: "Scadenza" },
    { id: "list", name: "Categoria/Lista" },
    { id: "amountCents", name: "Importo" },
    { id: "tags", name: "Tag (separati da |)" },
    { id: "assignees", name: "Assignee (Email)" },
];

export function CSVImportWizard({ open, onClose, projectId, onSuccess }: CSVImportWizardProps) {
    const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Importing
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewRows, setPreviewRows] = useState<any[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseHeaders(selectedFile);
        }
    };

    const parseHeaders = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length > 0) {
                // Simple CSV parser for headers (handles quotes partially)
                const firstLine = lines[0];
                const cols = firstLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
                setHeaders(cols);

                const preview = lines.slice(1, 4).map(line => {
                    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
                });
                setPreviewRows(preview);

                // Initial mapping guess
                const newMapping: Record<string, string> = {};
                cols.forEach(h => {
                    const lower = h.toLowerCase();
                    if (lower === "name" || lower === "title" || lower === "nome") newMapping[h] = "title";
                    else if (lower === "status" || lower === "stato") newMapping[h] = "status";
                    else if (lower === "list" || lower === "lista" || lower === "category") newMapping[h] = "list";
                    else if (lower === "assignees" || lower === "assignee") newMapping[h] = "assignees";
                    else if (lower === "due date" || lower === "scadenza" || lower === "date") newMapping[h] = "dueDate";
                    else if (lower === "description" || lower === "descrizione") newMapping[h] = "description";
                    else newMapping[h] = "custom"; // Default to custom for everything else
                });
                setMapping(newMapping);
            }
        };
        reader.readAsText(file);
    };

    const startImport = async () => {
        setImporting(true);
        setStep(3);
        try {
            // 1. First, create necessary custom fields
            const customFieldMappings = Object.entries(mapping).filter(([_, target]) => target === "custom");

            for (const [header, _] of customFieldMappings) {
                await fetch(`/api/projects/${projectId}/custom-fields`, {
                    method: 'POST',
                    body: JSON.stringify({ name: header, type: 'text' })
                }).then(res => res.json().catch(() => ({})));
            }

            // 2. Read full file and send to backend for processing
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;

                const res = await fetch(`/api/projects/${projectId}/import/csv`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csvData: text, mapping })
                });

                const data = await res.json();
                if (res.ok) {
                    toast.success(`Importati ${data.count} task con successo`);
                    onSuccess();
                    onClose();
                } else {
                    throw new Error(data.error || "Errore durante l'import");
                }
            };
            reader.readAsText(file!);

        } catch (e: any) {
            toast.error(e.message);
            setStep(2);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Importa Task da CSV</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-6">
                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-12 px-6 bg-muted/20">
                            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">Trascina il file CSV qui</h3>
                            <p className="text-sm text-muted-foreground mb-6 text-center">
                                Oppure clicca per selezionare un file dal tuo computer.<br />
                                Il separatore deve essere la virgola (,).
                            </p>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                                Seleziona File
                            </Button>
                            {file && (
                                <div className="mt-4 flex items-center gap-2 text-primary font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {file.name}
                                    <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                                        Continua
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 items-start">
                                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <div className="text-sm text-blue-800 dark:text-blue-300">
                                    Mappa le colonne del tuo CSV ai campi della piattaforma.
                                    Le colonne mappate come <strong>"Campo Personalizzato"</strong> verranno create automaticamente se non esistono.
                                </div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Colonna CSV</TableHead>
                                        <TableHead>Esempio Valore</TableHead>
                                        <TableHead>Mappa a</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {headers.map((h, i) => (
                                        <TableRow key={h}>
                                            <TableCell className="font-medium">{h}</TableCell>
                                            <TableCell className="text-muted-foreground truncate max-w-[200px]">
                                                {previewRows[0]?.[i] || "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={mapping[h]}
                                                    onValueChange={(v) => setMapping(prev => ({ ...prev, [h]: v }))}
                                                >
                                                    <SelectTrigger className="w-[200px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SYSTEM_FIELDS.map(f => (
                                                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                                        ))}
                                                        <SelectItem value="custom">✨ Nuovo Campo Pers.</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                            <h3 className="text-lg font-medium mb-2">Importazione in corso...</h3>
                            <p className="text-sm text-muted-foreground text-center">
                                Stiamo creando le task e i campi personalizzati.<br />
                                Non chiudere questa finestra.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/5 border-t">
                    {step === 2 && (
                        <>
                            <Button variant="ghost" onClick={() => setStep(1)} disabled={importing}>Indietro</Button>
                            <Button onClick={startImport} disabled={importing}>Inizia Importazione</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
