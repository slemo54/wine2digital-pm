"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

type ChecklistItem = {
  id: string;
  content: string;
  completed: boolean;
  position: number;
};

type Checklist = {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
};

type Props = {
  taskId: string;
  subtaskId: string;
  open: boolean;
  disabled?: boolean;
};

function normalizeChecklists(input: unknown): Checklist[] {
  if (!input || typeof input !== "object") return [];
  const raw = (input as any).checklists;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => ({
      id: String(c?.id || ""),
      title: String(c?.title || ""),
      position: typeof c?.position === "number" ? c.position : 0,
      items: Array.isArray(c?.items)
        ? c.items.map((i: any) => ({
            id: String(i?.id || ""),
            content: String(i?.content || ""),
            completed: Boolean(i?.completed),
            position: typeof i?.position === "number" ? i.position : 0,
          }))
        : [],
    }))
    .filter((c) => c.id);
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

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(baseUrl, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String((data as any)?.error || "Failed to load checklists");
        throw new Error(msg);
      }
      setChecklists(normalizeChecklists(data));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load checklists";
      if (msg.toLowerCase().includes("table missing") || msg.includes("Run Prisma migrations")) {
        toast.error("Checklists non disponibili: applica prima le migrations Prisma.");
      } else {
        toast.error(msg);
      }
      setChecklists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void refresh();
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Create failed"));
      const checklist = (data as any)?.checklist;
      if (checklist?.id) {
        setChecklists((prev) => [...prev, normalizeChecklists({ checklists: [checklist] })[0]].filter(Boolean));
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Update failed"));
      setChecklists((prev) => prev.map((c) => (c.id === checklistId ? { ...c, title } : c)));
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Delete failed"));
      setChecklists((prev) => prev.filter((c) => c.id !== checklistId));
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Create failed"));
      const item = (data as any)?.item;
      if (item?.id) {
        setChecklists((prev) =>
          prev.map((c) =>
            c.id === checklistId
              ? { ...c, items: [...c.items, { id: item.id, content, completed: false, position: item.position ?? 0 }] }
              : c
          )
        );
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
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, completed } : i)) } : c
      )
    );
    try {
      const res = await fetch(
        `${baseUrl}/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Update failed"));
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as any)?.error || "Delete failed"));
      setChecklists((prev) =>
        prev.map((c) => (c.id === checklistId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c))
      );
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
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
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


