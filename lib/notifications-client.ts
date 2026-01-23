"use client";

const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed" as const;

export function emitNotificationsChanged(unreadCount?: number): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { unreadCount } }));
      return;
    }
  } catch {
    // ignore
  }
  const ev = typeof Event === "function" ? new Event(NOTIFICATIONS_CHANGED_EVENT) : ({ type: NOTIFICATIONS_CHANGED_EVENT } as any);
  window.dispatchEvent(ev);
}

export async function markNotificationRead(notificationId: string): Promise<{ ok: boolean; unreadCount?: number }> {
  const id = String(notificationId || "").trim();
  if (!id) return { ok: false };
  const res = await fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationId: id }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  const unreadCount = Number.isFinite((data as any)?.unreadCount) ? Number((data as any).unreadCount) : undefined;
  emitNotificationsChanged(unreadCount);
  return { ok: true, unreadCount };
}

export async function markAllRead(): Promise<{ ok: boolean; unreadCount?: number }> {
  const res = await fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markAllRead: true }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  const unreadCount = Number.isFinite((data as any)?.unreadCount) ? Number((data as any).unreadCount) : undefined;
  emitNotificationsChanged(unreadCount);
  return { ok: true, unreadCount };
}

export async function markTaskNotificationsRead(
  taskId: string,
  opts?: { subtaskId?: string | null; types?: string[]; excludeTypes?: string[] }
): Promise<{ ok: boolean; unreadCount?: number }> {
  const id = String(taskId || "").trim();
  if (!id) return { ok: false };
  const sub = opts?.subtaskId ? String(opts.subtaskId).trim() : "";
  const types = Array.isArray(opts?.types) ? opts!.types!.map(String).map((x) => x.trim()).filter(Boolean) : [];
  const excludeTypes = Array.isArray(opts?.excludeTypes)
    ? opts!.excludeTypes!.map(String).map((x) => x.trim()).filter(Boolean)
    : [];
  const res = await fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId: id,
      ...(sub ? { subtaskId: sub } : {}),
      ...(types.length > 0 ? { types } : {}),
      ...(excludeTypes.length > 0 ? { excludeTypes } : {}),
    }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  const unreadCount = Number.isFinite((data as any)?.unreadCount) ? Number((data as any).unreadCount) : undefined;
  emitNotificationsChanged(unreadCount);
  return { ok: true, unreadCount };
}

