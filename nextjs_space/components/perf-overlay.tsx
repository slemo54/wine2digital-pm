"use client";

import { useEffect, useMemo, useState } from "react";
import { clearPerfEvents, getPerfEvents, isPerfEnabled, onPerfEvent, type PerfEvent } from "@/lib/perf-client";
import { Button } from "@/components/ui/button";

function formatTs(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function PerfOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<PerfEvent[]>([]);

  useEffect(() => {
    const onPop = () => setEnabled(isPerfEnabled());
    setEnabled(isPerfEnabled());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setEvents(getPerfEvents());
    return onPerfEvent((e) => {
      setEvents((prev) => [...prev, e].slice(-50));
    });
  }, [enabled]);

  const rows = useMemo(() => [...events].reverse().slice(0, 12), [events]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] w-[360px] max-w-[calc(100vw-24px)] rounded-lg border bg-background/95 backdrop-blur p-3 shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-semibold">Perf (perf=1)</div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => {
            clearPerfEvents();
            setEvents([]);
          }}
        >
          Pulisci
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Nessun evento ancora.</div>
      ) : (
        <div className="space-y-1 max-h-[280px] overflow-auto pr-1">
          {rows.map((e, idx) => (
            <div key={`${e.ts}-${idx}`} className="text-[11px] leading-snug">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono truncate">{e.name}</div>
                <div className="font-mono tabular-nums text-muted-foreground">{e.durationMs.toFixed(1)}ms</div>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">
                {formatTs(e.ts)}
                {e.meta && Object.keys(e.meta).length > 0 ? ` • ${JSON.stringify(e.meta)}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

