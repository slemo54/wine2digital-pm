"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        standardStartTime: "09:00",
        standardEndTime: "18:00",
        breakDurationMin: 60,
        lateToleranceMin: 15,
    });

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
                }
            })
            .catch(() => toast.error("Failed to load settings"))
            .finally(() => setLoading(false));
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
        </div>
    );
}
