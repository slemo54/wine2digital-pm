"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import { Loader2, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";


function translateCommitMessage(msg: string): string {
    const isFeat = msg.startsWith('feat:');
    const isFix = msg.startsWith('fix:');

    if (!isFeat && !isFix) return msg;

    const prefix = isFeat ? "Nuova funzionalità:" : "Correzione:";
    const rest = msg.replace(/^(feat|fix):\s*/, '');
    const capitalized = rest.charAt(0).toUpperCase() + rest.slice(1);

    return `${prefix} ${capitalized}`;
}

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        standardStartTime: "09:00",
        standardEndTime: "18:00",
        breakDurationMin: 60,
        lateToleranceMin: 15,
        departments: ["Backoffice", "IT", "Grafica", "Social"],
    });
    const [commits, setCommits] = useState<any[]>([]);
    const [loadingCommits, setLoadingCommits] = useState(false);

    const [newDept, setNewDept] = useState("");
    const [editingDept, setEditingDept] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");

    const addDepartment = () => {
        const trimmed = newDept.trim();
        if (!trimmed) return;
        if (settings.departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
            toast.error("Reparto già esistente");
            return;
        }
        setSettings(prev => ({
            ...prev,
            departments: [...prev.departments, trimmed]
        }));
        setNewDept("");
    };

    const removeDepartment = async (dept: string) => {
        // TODO: check if department is used. The API to check it should be queried or we do a simple check.
        // I will implement a quick api check
        try {
            const res = await fetch(`/api/departments/check-usage?department=${encodeURIComponent(dept)}`);
            const data = await res.json();

            if (data.isUsed) {
                toast.error(`Questo reparto ha ${data.count} utenti assegnati. Riassegnali prima di eliminare.`);
                return;
            }

            if (confirm(`Eliminare il reparto ${dept}?`)) {
                setSettings(prev => ({
                    ...prev,
                    departments: prev.departments.filter(d => d !== dept)
                }));
            }
        } catch (e) {
            toast.error("Errore durante la verifica del reparto");
        }
    };

    const startEditing = (dept: string) => {
        setEditingDept(dept);
        setEditingValue(dept);
    };

    const saveEdit = (oldDept: string) => {
        const trimmed = editingValue.trim();
        if (!trimmed) {
            setEditingDept(null);
            return;
        }

        if (trimmed.toLowerCase() !== oldDept.toLowerCase() &&
            settings.departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
            toast.error("Reparto già esistente");
            return;
        }

        setSettings(prev => ({
            ...prev,
            departments: prev.departments.map(d => d === oldDept ? trimmed : d)
        }));
        setEditingDept(null);
    };


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
                        departments: data.departments || ["Backoffice", "IT", "Grafica", "Social"],
                    });
                }
            })
            .catch(() => toast.error("Failed to load settings"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setLoadingCommits(true);
        fetch("/api/github/commits")
            .then((res) => {
                if (res.ok) return res.json();
                throw new Error("Failed to load commits");
            })
            .then((data) => setCommits((data.commits || []).filter((c: any) => c.messageTitle?.startsWith("feat:") || c.messageTitle?.startsWith("fix:"))))
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error("Failed");
            toast.success("Settings saved");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Global Settings</h1>
                <p className="text-muted-foreground">Configure working hours and attendance rules.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Work Rules</CardTitle>
                    <CardDescription>Define standard office hours and tolerances for automated tracking.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="standardStartTime">Standard Start Time</Label>
                                <Input
                                    id="standardStartTime"
                                    name="standardStartTime"
                                    type="time"
                                    value={settings.standardStartTime}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="standardEndTime">Standard End Time</Label>
                                <Input
                                    id="standardEndTime"
                                    name="standardEndTime"
                                    type="time"
                                    value={settings.standardEndTime}
                                    onChange={handleChange}
                                />
                            </div>

                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Gestione Reparti</CardTitle>
                    <CardDescription>Gestisci i reparti aziendali disponibili per l&apos;assegnazione agli utenti.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {settings.departments.map((dept) => (
                                <div key={dept} className="flex items-center">
                                    {editingDept === dept ? (
                                        <div className="flex items-center gap-1">
                                            <Input
                                                value={editingValue}
                                                onChange={(e) => setEditingValue(e.target.value)}
                                                className="h-8 w-32"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit(dept);
                                                    if (e.key === 'Escape') setEditingDept(null);
                                                }}
                                                onBlur={() => saveEdit(dept)}
                                            />
                                        </div>
                                    ) : (
                                        <Badge variant="secondary" className="text-sm py-1 px-3 flex items-center gap-2 cursor-pointer" onClick={() => startEditing(dept)}>
                                            {dept}
                                            <X
                                                className="h-3 w-3 hover:text-destructive cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); removeDepartment(dept); }}
                                            />
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 max-w-sm pt-2 border-t">
                            <Input
                                placeholder="Nuovo reparto..."
                                value={newDept}
                                onChange={(e) => setNewDept(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
                            />
                            <Button type="button" onClick={addDepartment} variant="secondary">
                                <Plus className="h-4 w-4 mr-1" /> Aggiungi
                            </Button>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSubmit} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Salva Reparti
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isAdmin && <Card>
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
                                            {translateCommitMessage(commit.messageTitle)}
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
            </Card>}
        </div>
    );
}
