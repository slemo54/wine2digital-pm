"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

type SearchResult =
  | { type: "task"; id: string; title: string; subtitle?: string; href: string; projectId?: string }
  | { type: "project"; id: string; title: string; subtitle?: string; href: string }
  | { type: "file"; id: string; title: string; subtitle?: string; href: string; projectId?: string }
  | { type: "wiki"; id: string; title: string; subtitle?: string; href: string; projectId?: string };

function typeLabel(t: SearchResult["type"]): string {
  switch (t) {
    case "task":
      return "Task";
    case "project":
      return "Progetto";
    case "file":
      return "File";
    case "wiki":
      return "Wiki";
  }
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const mod = e.metaKey || e.ctrlKey;
      if (mod && isK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Search failed");
        if (!cancelled) setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q]);

  const grouped = useMemo(() => {
    const g: Record<string, SearchResult[]> = { task: [], project: [], file: [], wiki: [] };
    for (const r of results) g[r.type].push(r);
    return g;
  }, [results]);

  const onSelect = (item: SearchResult) => {
    setOpen(false);
    if (item.type === "task" && item.projectId) {
      router.push(`/project/${item.projectId}?task=${encodeURIComponent(item.id)}`);
      return;
    }
    router.push(item.href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder={loading ? "Cerco…" : "Cerca task, progetti, file, wiki…"}
      />
      <CommandList>
        <CommandEmpty>Nessun risultato.</CommandEmpty>

        {(["task", "project", "wiki", "file"] as const).map((t) => (
          <div key={t}>
            {grouped[t].length > 0 ? (
              <CommandGroup heading={typeLabel(t)}>
                {grouped[t].map((r) => (
                  <CommandItem key={`${r.type}-${r.id}`} value={`${r.title} ${r.subtitle || ""}`} onSelect={() => onSelect(r)}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.title}</div>
                        {r.subtitle ? <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div> : null}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {typeLabel(r.type)}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {t !== "file" ? <CommandSeparator /> : null}
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}


