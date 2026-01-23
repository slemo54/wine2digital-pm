"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { useParams } from "next/navigation";

interface CustomField {
    id: string;
    name: string;
    type: string;
    description?: string;
    options?: any;
}

interface CustomFieldValue {
    id: string;
    customFieldId: string;
    value: string | null;
}

interface CustomFieldsSectionProps {
    taskId: string;
    projectId: string;
}

export function CustomFieldsSection({ taskId, projectId }: CustomFieldsSectionProps) {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [values, setValues] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                // Fetch definitions
                const defRes = await fetch(`/api/projects/${projectId}/custom-fields`);
                const defData = await defRes.json();
                setFields(defData.customFields || []);

                // Fetch task specific values
                const valRes = await fetch(`/api/tasks/${taskId}/custom-fields`);
                const valData = await valRes.json();
                const valueMap: Record<string, string> = {};
                (valData.values || []).forEach((v: any) => {
                    valueMap[v.customFieldId] = v.value || "";
                });
                setValues(valueMap);
            } catch (e) {
                console.error("Custom fields error:", e);
            } finally {
                setLoading(false);
            }
        }
        if (projectId) loadData();
    }, [projectId]);

    useEffect(() => {
        // We'll need the initial values from the task. 
        // This component will be used inside TaskDetailModal which already has task data.
    }, [taskId]);

    const updateValue = async (fieldId: string, value: string) => {
        try {
            // Optimistic update
            setValues(prev => ({ ...prev, [fieldId]: value }));

            await fetch(`/api/tasks/${taskId}/custom-fields`, {
                method: 'POST',
                body: JSON.stringify({ fieldId, value })
            });
        } catch (e) {
            toast.error("Errore nel salvataggio del campo");
        }
    };

    if (loading) return null;
    if (fields.length === 0) return null;

    return (
        <div className="space-y-4 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Campi Personalizzati
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field) => (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id}>{field.name}</Label>
                        <Input
                            id={field.id}
                            value={values[field.id] || ""}
                            onChange={(e) => updateValue(field.id, e.target.value)}
                            placeholder={field.description || `Inserisci ${field.name}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
