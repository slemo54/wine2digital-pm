export type PerfEvent = {
  name: string;
  durationMs: number;
  ts: number;
  meta?: Record<string, unknown>;
};

const PERF_EVENT_NAME = "w2d:perf";
const PERF_STORE_KEY = "__W2D_PERF_EVENTS";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function isPerfEnabled(): boolean {
  if (!isBrowser()) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("perf") === "1";
  } catch {
    return false;
  }
}

function getStore(): PerfEvent[] {
  if (!isBrowser()) return [];
  const w = window as unknown as Record<string, unknown>;
  const raw = w[PERF_STORE_KEY];
  return Array.isArray(raw) ? (raw as PerfEvent[]) : [];
}

function setStore(events: PerfEvent[]): void {
  if (!isBrowser()) return;
  const w = window as unknown as Record<string, unknown>;
  w[PERF_STORE_KEY] = events;
}

export function getPerfEvents(): PerfEvent[] {
  return getStore();
}

export function clearPerfEvents(): void {
  setStore([]);
}

export function onPerfEvent(handler: (e: PerfEvent) => void): () => void {
  if (!isBrowser()) return () => {};
  const listener = (ev: Event) => {
    const ce = ev as CustomEvent;
    const detail = ce?.detail as PerfEvent | undefined;
    if (!detail || typeof detail.name !== "string") return;
    handler(detail);
  };
  window.addEventListener(PERF_EVENT_NAME, listener as EventListener);
  return () => {
    window.removeEventListener(PERF_EVENT_NAME, listener as EventListener);
  };
}

export function startPerfTimer(
  name: string,
  meta?: Record<string, unknown>
): (endMeta?: Record<string, unknown>) => void {
  if (!isPerfEnabled()) return () => {};
  if (typeof performance === "undefined") return () => {};

  const start = performance.now();

  return (endMeta?: Record<string, unknown>) => {
    const durationMs = performance.now() - start;
    const event: PerfEvent = {
      name,
      durationMs,
      ts: Date.now(),
      meta: { ...(meta || {}), ...(endMeta || {}) },
    };

    const events = getStore();
    const next = [...events, event].slice(-200);
    setStore(next);

    try {
      window.dispatchEvent(new CustomEvent(PERF_EVENT_NAME, { detail: event }));
    } catch {
      // ignore
    }

    // eslint-disable-next-line no-console
    console.info(`[perf] ${name} ${durationMs.toFixed(1)}ms`, event.meta || {});
  };
}

