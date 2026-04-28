"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { AutosizeTextarea } from "@/components/ui/autosize-textarea";
import { z } from "zod";

const checklistsCache = new Map<string, Checklist[]>();

const checklistItemSchema = z.object({
  id: z.coerce.string(),
  content: z.coerce.string(),
  completed: z.coerce.boolean(),
  position: z.coerce.number().default(0),
});

type ChecklistItem = z.infer<typeof checklistItemSchema>;

const checklistSchema = z.object({
  id: z.coerce.string(),
  title: z.coerce.string(),
  position: z.coerce.number().default(0),
  items: z.array(checklistItemSchema).default([]),
});

type Checklist = z.infer<typeof checklistSchema>;

const checklistsResponseSchema = z.object({
  checklists: z.array(checklistSchema),
});

const singleChecklistResponseSchema = z.object({
  checklist: checklistSchema,
});

const singleItemResponseSchema = z.object({
  item: checklistItemSchema,
});

const errorResponseSchema = z.object({
  error: z.string().optional(),
});

type Props = {
  taskId: string;
  subtaskId: string;
  open: boolean;
  disabled?: boolean;
};

function normalizeChecklists(input: unknown): Checklist[] {
  const result = checklistsResponseSchema.safeParse(input);
  if (!result.success) return [];
  return result.data.checklists;
}

export function SubtaskChecklists({ taskId, subtaskId, open, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [editingTitles, setEditingTitles] = useState<Record<string, string>>({});
  const [draftItemByChecklist, setDraftItemByChecklist] = useState<Record<string, string>>({});

  const baseUrl = useMemo(
    () => `/api/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}/checklists`,
    [taskId, subtaskId]
  );

  const refresh = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch(baseUrl, { cache: "no-store" });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorData = errorResponseSchema.safeParse(data);
        const msg = errorData.success && errorData.data.error ? errorData.data.error : "Failed to load checklists";
        throw new Error(msg);
      }
      const next = normalizeChecklists(data);
      setChecklists(next);
      checklistsCache.set(baseUrl, next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load checklists";
      if (!opts?.silent) {
        if (msg.toLowerCase().includes("table missing") || msg.includes("Run Prisma migrations")) {
          toast.error("Checklists non disponibili: applica prima le migrations Prisma.");
        } else {
          toast.error(msg);
        }
        setChecklists([]);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const cached = checklistsCache.get(baseUrl);
    if (cached) setChecklists(cached);
    void refresh({ silent: Boolean(cached) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, baseUrl]);

  const createChecklist = async () => {
    const title = newChecklistTitle.trim() || "Checklist";
    setLoading(true);
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorData = errorResponseSchema.safeParse(data);
        throw new Error(errorData.success && errorData.data.error ? errorData.data.error : "Create failed");
      }
      const parsed = singleChecklistResponseSchema.safeParse(data);
      if (parsed.success) {
        const checklist = parsed.data.checklist;
        setChecklists((prev) => {
          const next = [...prev, checklist];
          checklistsCache.set(baseUrl, next);
          return next;
        });
      } else {
        await refresh();
      }
      setNewChecklistTitle("");
      toast.success("Checklist creata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  };

  const saveChecklistTitle = async (checklistId: string) => {
    const title = (editingTitles[checklistId] ?? "").trim();
    if (!title) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/${encodeURIComponent(checklistId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorData = errorResponseSchema.safeParse(data);
        throw new Error(errorData.success && errorData.data.error ? errorData.data.error : "Update failed");
      }
      setChecklists((prev) => {
        const next = prev.map((c) => (c.id === checklistId ? { ...c, title } : c));
        checklistsCache.set(baseUrl, next);
        return next;
      });
      toast.success("Checklist aggiornata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteChecklist = async (checklistId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/${encodeURIComponent(checklistId)}`, { method: "DELETE" });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorData = errorResponseSchema.safeParse(data);
        throw new Error(errorData.success && errorData.data.error ? errorData.data.error : "Delete failed");
      }
      setChecklists((prev) => {
        const next = prev.filter((c) => c.id !== checklistId);
        checklistsCache.set(baseUrl, next);
        return next;
      });
      toast.success("Checklist eliminata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (checklistId: string) => {
    const content = (draftItemByChecklist[checklistId] ?? "").trim();
    if (!content) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/${encodeURIComponent(checklistId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorData = errorResponseSchema.safeParse(data);
        throw new Error(errorData.success && errorData.data.error ? errorData.data.error : "Create failed");
      }
      const parsed = singleItemResponseSchema.safeParse(data);
      if (parsed.success) {
        const item = parsed.data.item;
        setChecklists((prev) => {
          const next = prev.map((c) =>
            c.id === checklistId
              ? { ...c, items: [...c.items, item] }
              : c
          );
          checklistsCache.set(baseUrl, next);
          return next;
        });
      } else {
        await refresh();
      }
      setDraftItemByChecklist((prev) => ({ ...prev, [checklistId]: "" }));
      toast.success("Elemento aggiunto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (checklistId: string, itemId: string, completed: boolean) => {
    setChecklists((prev) => {
      const next = prev.map((c) =>
        c.id === checklistId ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, completed } : i)) } : c
      );
      checklistsCache.set(baseUrl, next);
      return next;
    });
    try {
      const res = await fetch(
        `${baseUrl}/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        }
      );
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorData = errorResponseSchema.safeParse(data);
        throw new Error(errorData.success && errorData.data.error ? errorData.data.error : "Update failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      await refresh();
    }
  };

  const deleteItem = async (checklistId: string, itemId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${baseUrl}/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE" }
      );
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorData = errorResponseSchema.safeParse(data);
        throw new Error(errorData.success && errorData.data.error ? errorData.data.error : "Delete failed");
      }
      setChecklists((prev) => {
        const next = prev.map((c) => (c.id === checklistId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c));
        checklistsCache.set(baseUrl, next);
        return next;
      });
      toast.success("Elemento eliminato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Checklists</div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newChecklistTitle}
          onChange={(e) => setNewChecklistTitle(e.target.value)}
          placeholder="Nuova checklist…"
          disabled={disabled || loading}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void createChecklist();
          }}
        />
        <Button onClick={createChecklist} disabled={disabled || loading}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}

      {checklists.length === 0 && !loading ? (
        <div className="text-sm text-muted-foreground">Nessuna checklist.</div>
      ) : null}

      <div className="space-y-4">
        {checklists.map((c) => (
          <div key={c.id} className="rounded-lg border p-3 bg-background">
            <div className="flex items-center gap-2">
              <Input
                value={editingTitles[c.id] ?? c.title}
                onChange={(e) => setEditingTitles((prev) => ({ ...prev, [c.id]: e.target.value }))}
                onBlur={() => void saveChecklistTitle(c.id)}
                disabled={disabled || loading}
                className="font-medium"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void deleteChecklist(c.id)}
                disabled={disabled || loading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {c.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nessun elemento.</div>
              ) : null}
              {c.items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-md border px-2 py-1">
                  <Checkbox
                    checked={i.completed}
                    onCheckedChange={(checked) => void toggleItem(c.id, i.id, !!checked)}
                    disabled={disabled || loading}
                  />
                  <div className={i.completed ? "text-sm line-through text-muted-foreground flex-1" : "text-sm flex-1"}>
                    {i.content}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void deleteItem(c.id, i.id)}
                    disabled={disabled || loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Input
                value={draftItemByChecklist[c.id] ?? ""}
                onChange={(e) => setDraftItemByChecklist((prev) => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="Aggiungi elemento…"
                disabled={disabled || loading}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void addItem(c.id);
                }}
              />
              <Button variant="outline" onClick={() => void addItem(c.id)} disabled={disabled || loading}>
                Add
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


