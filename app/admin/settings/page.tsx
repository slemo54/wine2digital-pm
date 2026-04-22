"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

type AbsenceType = {
    id: string;
    label: string;
    enabled: boolean;
};

const DEFAULT_ABSENCE_TYPES: AbsenceType[] = [
    { id: 'ferie', label: 'Ferie', enabled: true },
    { id: 'malattia', label: 'Malattia', enabled: true },
    { id: 'permesso', label: 'Permesso', enabled: true },
    { id: 'straordinario', label: 'Straordinario', enabled: true }
];

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        standardStartTime: "09:00",
        standardEndTime: "18:00",
        breakDurationMin: 60,
        lateToleranceMin: 15,
    });
    const [absenceTypes, setAbsenceTypes] = useState<AbsenceType[]>(DEFAULT_ABSENCE_TYPES);
    const [newAbsenceLabel, setNewAbsenceLabel] = useState("");

    const [commits, setCommits] = useState<any[]>([]);
    const [loadingCommits, setLoadingCommits] = useState(false);

    useEffect(() => {
        fetch("/api/admin/settings")
            .then((res) => {
                if (res.ok) return res.json();
                throw new Error("Failed");
            })
            .then((data) => {
                if (data.id) {
                    setSettings({
                        standardStartTime: data.standardStartTime,
                        standardEndTime: data.standardEndTime,
                        breakDurationMin: data.breakDurationMin,
                        lateToleranceMin: data.lateToleranceMin,
                    });
                    if (data.absenceTypes && Array.isArray(data.absenceTypes) && data.absenceTypes.length > 0) {
                        setAbsenceTypes(data.absenceTypes);
                    }
                }
            })
            .catch(() => toast.error("Impossibile caricare le impostazioni"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setLoadingCommits(true);
        fetch("/api/github/commits")
            .then((res) => {
                if (res.ok) return res.json();
                throw new Error("Failed to load commits");
            })
            .then((data) => setCommits(data.commits || []))
            .catch((err) => {
                console.error("Failed to load changelog:", err);
                setCommits([]);
            })
            .finally(() => setLoadingCommits(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: name.endsWith("Min") ? parseInt(value) || 0 : value
        }));
    };

    const handleAddAbsenceType = () => {
        if (!newAbsenceLabel.trim()) return;
        const id = newAbsenceLabel.trim().toLowerCase().replace(/\s+/g, '-');
        if (absenceTypes.some(t => t.id === id)) {
            toast.error("Un tipo con questo nome esiste già");
            return;
        }
        setAbsenceTypes(prev => [...prev, { id, label: newAbsenceLabel.trim(), enabled: true }]);
        setNewAbsenceLabel("");
    };

    const handleToggleAbsenceType = (id: string, enabled: boolean) => {
        setAbsenceTypes(prev => prev.map(t => t.id === id ? { ...t, enabled } : t));
    };

    const handleDeleteAbsenceType = (id: string) => {
        setAbsenceTypes(prev => prev.filter(t => t.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...settings,
                absenceTypes
            };
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed");
            toast.success("Impostazioni salvate con successo");
        } catch (error) {
            toast.error("Impossibile salvare le impostazioni");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Impostazioni Globali</h1>
                <p className="text-muted-foreground">Configura orari di lavoro, tolleranze e tipi di assenza.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Regole Orarie</CardTitle>
                        <CardDescription>Definisci gli orari standard di ufficio e le tolleranze.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="standardStartTime">Orario di inizio standard</Label>
                                <Input
                                    id="standardStartTime"
                                    name="standardStartTime"
                                    type="time"
                                    value={settings.standardStartTime}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="standardEndTime">Orario di fine standard</Label>
                                <Input
                                    id="standardEndTime"
                                    name="standardEndTime"
                                    type="time"
                                    value={settings.standardEndTime}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tipi di Assenza</CardTitle>
                        <CardDescription>Gestisci i tipi di assenza selezionabili dagli utenti nel form di richiesta.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            {absenceTypes.map((type) => (
                                <div key={type.id} className="flex items-center justify-between p-3 border rounded-md">
                                    <div className="font-medium">{type.label}</div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`toggle-${type.id}`} className="text-sm text-muted-foreground cursor-pointer">
                                                {type.enabled ? "Attivo" : "Nascosto"}
                                            </Label>
                                            <Switch
                                                id={`toggle-${type.id}`}
                                                checked={type.enabled}
                                                onCheckedChange={(checked) => handleToggleAbsenceType(type.id, checked)}
                                            />
                                        </div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Questa azione rimuoverà il tipo di assenza &quot;{type.label}&quot;. Le richieste passate con questo tipo non verranno eliminate, ma non sarà più possibile selezionarlo per nuove richieste.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteAbsenceType(type.id)}>
                                                        Elimina
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                            {absenceTypes.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">Nessun tipo configurato. Verranno usati i valori di default nel form.</p>
                            )}
                        </div>

                        <Separator />

                        <div className="flex items-end gap-4">
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="newAbsence">Nuovo tipo di assenza</Label>
                                <Input
                                    id="newAbsence"
                                    placeholder="Es. Visita medica"
                                    value={newAbsenceLabel}
                                    onChange={(e) => setNewAbsenceLabel(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddAbsenceType();
                                        }
                                    }}
                                />
                            </div>
                            <Button type="button" variant="outline" onClick={handleAddAbsenceType} disabled={!newAbsenceLabel.trim()}>
                                <Plus className="h-4 w-4 mr-2" />
                                Aggiungi
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={saving} className="bg-[#F97316] hover:bg-[#EA580C] text-white">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salva Modifiche
                    </Button>
                </div>
            </form>

            <Card>
                <CardHeader>
                    <CardTitle>Changelog</CardTitle>
                    <CardDescription>
                        Recent updates and changes to the application from GitHub.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingCommits ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : commits.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recent commits found.</p>
                    ) : (
                        <div className="space-y-3">
                            {commits.map((commit) => (
                                <div
                                    key={commit.sha}
                                    className="flex items-start gap-3 py-3 border-b last:border-b-0"
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {commit.messageTitle}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(commit.date).toLocaleString("it-IT", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {" · "}
                                            {commit.author}
                                        </p>
                                    </div>
                                    <a
                                        href={commit.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 text-xs text-primary hover:underline"
                                    >
                                        View
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
